import { useEffect, useMemo, useState } from "react";
import { DashboardPage } from "../pages/DashboardPage";
import { AppearanceSettingsPage } from "../pages/AppearanceSettingsPage";
import { FlashcardsPage } from "../pages/FlashcardsPage";
import { ImportsPage } from "../pages/ImportsPage";
import { JLPTExamPage } from "../pages/JLPTExamPage";
import { KanjiPage } from "../pages/KanjiPage";
import { ListeningPage } from "../pages/ListeningPage";
import { ReadingPage } from "../pages/ReadingPage";
import { GrammarPage } from "../pages/GrammarPage";
import { NotesPage } from "../pages/NotesPage";
import { NeuroAnalysisPage } from "../pages/NeuroAnalysisPage";
import { PaperUploadPage } from "../pages/PaperUploadPage";
import { ProfilePage } from "../pages/ProfilePage";
import { SessionsPage } from "../pages/SessionsPage";
import { TestsPage } from "../pages/TestsPage";
import { VocabPage } from "../pages/VocabPage";
import { LoginForm } from "../components/LoginForm";
import { SideMenu } from "../components/SideMenu";
import { QuickNoteButton } from "../components/QuickNoteButton";
import { FocusAudioWidget } from "../components/FocusAudioWidget";
import { CompanionWidget } from "../components/companion/CompanionWidget";
import { AppearanceProvider } from "./state/appearance";
import { ROUTES, setRoute, useRoute } from "./state/route";
import { useMe, UserProvider } from "./state/user";
import { applyNeuroUiMode } from "./theme/neuro";
import { getLearningLabel } from "./labels";

function AppShell() {
  const { me, logout } = useMe();
  const { route, def } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    applyNeuroUiMode(me?.profile.learning_type ?? "balanced", me?.profile.ui_prefs);
  }, [me?.profile.learning_type, me?.profile.ui_prefs]);

  const page = useMemo(() => {
    switch (route) {
      case "dashboard":
        return <DashboardPage />;
      case "flashcards":
        return <FlashcardsPage />;
      case "kanji":
        return <KanjiPage />;
      case "vocab":
        return <VocabPage />;
      case "listening":
        return <ListeningPage />;
      case "reading":
        return <ReadingPage />;
      case "grammar":
        return <GrammarPage />;
      case "tests":
        return <TestsPage />;
      case "jlptExam":
        return <JLPTExamPage />;
      case "paperUpload":
        return <PaperUploadPage />;
      case "notes":
        return <NotesPage />;
      case "sessions":
        return <SessionsPage />;
      case "appearance":
        return <AppearanceSettingsPage />;
      case "neuroAnalysis":
        return <NeuroAnalysisPage />;
      case "profile":
        return <ProfilePage />;
      case "imports":
        return <ImportsPage />;
      default:
        return <DashboardPage />;
    }
  }, [route]);

  if (!me) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="topbar__title">JLPT Neuro Master</div>
          <div className="topbar__meta">
            <span className="pill">Please sign in</span>
          </div>
        </header>
        <main className="content">
          <div className="grid">
            <LoginForm />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app app--authed"><SideMenu
      routes={ROUTES}
      active={route}
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      onNavigate={(k) => setRoute(k)}
    />

      <div className="main">
        <header className="topbar">
          <div className="topbar__left">
            <button className="btn menu" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              Menu
            </button>
            <div>
              <div className="topbar__title">{def.label}</div>
              <div className="topbar__sub">{def.description}</div>
            </div>
          </div>

          <div className="topbar__meta">
            <span className="pill">{me.profile.jlpt_level}</span>
            <span className="pill">{getLearningLabel(me.profile.learning_type, me.profile.ui_prefs)}</span>
            <button className="btn" onClick={logout} style={{ padding: "6px 10px" }}>
              Logout
            </button>
          </div>
        </header>

        <main className="content">{page}</main>
        <FocusAudioWidget />
        <CompanionWidget />
        <QuickNoteButton />
      </div>
    </div>
  );
}

export function App() {
  return (
    <UserProvider>
      <AppWithAppearance />
    </UserProvider>
  );
}

function AppWithAppearance() {
  const { me } = useMe();
  return (
    <AppearanceProvider key={me?.id ?? "anon"}>
      <AppShell />
    </AppearanceProvider>
  );
}
