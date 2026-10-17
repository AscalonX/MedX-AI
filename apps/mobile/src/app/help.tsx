import { space } from "@medx/shared";
import { Card, Page, T } from "@/components/ui";
import { STR } from "@/i18n";
import { useStore } from "@/store";

export default function Help() {
  const { lang, session } = useStore();
  const s = STR[lang];
  return (
    <Page>
      <T lang={lang} token="title" weight="bold" accessibilityRole="header" style={{ marginBottom: space[4] }}>{s.helpTitle}</T>
      <Card style={{ gap: space[3] }}>
        <T lang={lang}>{s.helpBody}</T>
        {session && <T lang="en" token="stat" weight="bold">{session.code}</T>}
        <T lang={lang} token="small" tone="inkSoft">{s.helpEmergency}</T>
      </Card>
      <T lang={lang} token="small" tone="graphite" style={{ marginTop: space[4] }}>{s.disclaimer}</T>
    </Page>
  );
}
