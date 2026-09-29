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

export async function deleteAssetsInBatches(
  ids: string[],
  batchSize: number = BATCH_SIZE
): Promise<void> {
  if (!ids.length) return;
  for (let i = 0; i < ids.length; i += batchSize) {
    await MediaLibrary.deleteAssetsAsync(ids.slice(i, i + batchSize));
    if (i + batchSize < ids.length) {
      await new Promise((r) => setTimeout(r, BREATHE_MS));
    }
  }
}
