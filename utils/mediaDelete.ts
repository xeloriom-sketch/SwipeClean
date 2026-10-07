// utils/mediaDelete.ts — suppression d'assets par lots
//
// Sur Android, `deleteAssetsAsync` passe la liste d'URI à un Intent système
// (`MediaStore.createDeleteRequest`) qui traverse un Binder : au-delà de quelques
// centaines d'entrées on prend une `TransactionTooLargeException`, non rattrapable
// depuis JS. La boîte de dialogue système passe en plus l'app en arrière-plan,
// ce qui la rend éligible à la destruction sous pression mémoire.
import * as MediaLibrary from "expo-media-library";

const BATCH_SIZE = 100;
const BREATHE_MS = 150;

export type DeleteOutcome = {
  /** Vrai seulement si *tous* les lots ont été confirmés par le système. */
  ok: boolean;
  /** Ids réellement supprimés — c'est sur eux, et eux seuls, que l'appelant compte. */
  deletedIds: string[];
};

/**
 * Supprime des assets par lots.
 *
 * `MediaLibrary.deleteAssetsAsync` renvoie `Promise<boolean>`: sur Android il vaut
 * `false` quand l'utilisateur refuse la boîte de dialogue système. Ce retour était
 * ignoré et la fonction résolvait normalement — l'appelant retirait alors les photos
 * de la corbeille et créditait l'espace libéré alors que les fichiers étaient toujours
 * sur l'appareil, devenus invisibles pour l'app. On remonte donc le verdict, lot par
 * lot: un refus arrête la boucle (inutile de harceler quelqu'un qui vient de dire non)
 * et seuls les lots confirmés sont déclarés supprimés.
 */
export async function deleteAssetsInBatches(
  ids: string[],
  batchSize: number = BATCH_SIZE
): Promise<DeleteOutcome> {
  if (!ids.length) return { ok: true, deletedIds: [] };

  const deletedIds: string[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const confirmed = await MediaLibrary.deleteAssetsAsync(batch);
    if (!confirmed) return { ok: false, deletedIds };
    deletedIds.push(...batch);
    if (i + batchSize < ids.length) {
      await new Promise((r) => setTimeout(r, BREATHE_MS));
    }
  }
  return { ok: true, deletedIds };
}
