import { space } from "@medx/shared";
import { NewVisitCard } from "@/components/newvisit";
import { Card, Page, T } from "@/components/ui";
import { STR } from "@/i18n";
import { useStore } from "@/store";

// No Fin here: this screen carries emergency numbers (DIRECTION section 11).
export default function Help() {
  const { lang, session } = useStore();
  const s = STR[lang];
  return (
    <Page>
      <T lang={lang} token="display" weight="extrabold" accessibilityRole="header" style={{ marginBottom: space[5] }}>{s.helpTitle}</T>
      <Card style={{ gap: space[3] }}>
        <T lang={lang}>{s.helpBody}</T>
        {session && <T lang="en" token="stat" weight="extrabold">{session.code}</T>}
        <T lang={lang} token="small" tone="inkSoft">{s.helpEmergency}</T>
      </Card>
      <NewVisitCard style={{ marginTop: space[4] }} />
      <T lang={lang} token="small" tone="graphite" style={{ marginTop: space[5] }}>{s.disclaimer}</T>
    </Page>
  );
}
