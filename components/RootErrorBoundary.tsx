// components/RootErrorBoundary.tsx — dernier filet avant l'écran blanc
//
// Une erreur de rendu non rattrapée démonte tout l'arbre React: l'utilisateur se
// retrouve devant un écran vide, sans rien à faire, et le développeur n'apprend la
// panne que si quelqu'un prend la peine de la signaler. Il n'y a ici ni Sentry ni
// remontée automatique (ce serait un module natif, donc un build, pas une mise à jour
// OTA) — on offre donc le minimum utile: on garde l'app debout, on montre ce qui s'est
// passé, et on donne un moyen d'envoyer le journal en deux tapes.
import React from "react";
import { View, Text, TouchableOpacity, ScrollView, Linking, Platform } from "react-native";
import * as Updates from "expo-updates";
import { devLog, logsAsText } from "../utils/devLogger";

const SUPPORT_EMAIL = "assiabillale@gmail.com";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

function buildReport(error: Error | null): string {
  const lines = [
    `Version: ${Updates.runtimeVersion ?? "inconnue"}`,
    `Canal: ${Updates.channel ?? "—"}`,
    `Mise à jour: ${Updates.updateId ?? "bundle d'origine"}`,
    `Plateforme: ${Platform.OS} ${Platform.Version}`,
    "",
    `Erreur: ${error?.message ?? "inconnue"}`,
    "",
    (error?.stack ?? "").split("\n").slice(0, 12).join("\n"),
    "",
    "--- Journal ---",
    logsAsText(),
  ];
  return lines.join("\n");
}

export default class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Part dans le journal, qui est persisté: il survivra au redémarrage.
    devLog("Crash", `${error.message}\n${(error.stack ?? "").split("\n").slice(0, 6).join("\n")}`, "error");
  }

  private reload = () => {
    // Recharge le bundle plutôt que de simplement vider l'état: l'arbre est démonté et
    // tout repart proprement, y compris les modules qui gardent un état de module.
    Updates.reloadAsync().catch(() => this.setState({ error: null }));
  };

  private sendReport = () => {
    const body = encodeURIComponent(buildReport(this.state.error));
    const subject = encodeURIComponent("SwipeClean — rapport d'erreur");
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: "#0d0d0d", paddingHorizontal: 28, justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", lineHeight: 30 }}>
          SwipeClean s&apos;est arrêté
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 22, marginTop: 10 }}>
          Aucune de tes photos n&apos;a été touchée. Tu peux relancer l&apos;app — et si tu
          veux aider à corriger ça, envoie le rapport : il contient seulement des
          informations techniques.
        </Text>

        <ScrollView
          style={{
            maxHeight: 120,
            marginTop: 20,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 17 }}>
            {error.message}
          </Text>
        </ScrollView>

        <TouchableOpacity
          onPress={this.reload}
          activeOpacity={0.85}
          style={{
            marginTop: 26,
            backgroundColor: "#1EB0AD",
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Relancer l&apos;app</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={this.sendReport} activeOpacity={0.7} style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Envoyer le rapport</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
