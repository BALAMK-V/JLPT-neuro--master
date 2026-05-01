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
import { GrammarCheckPage } from "../pages/GrammarCheckPage";
import { AIExamGeneratorPage } from "../pages/AIExamGeneratorPage";
import { SpeakingModePage } from "../pages/SpeakingModePage";
import { SentenceMiningPage } from "../pages/SentenceMiningPage";
import { MultiplayerQuizPage } from "../pages/MultiplayerQuizPage";
import { NotesPage } from "../pages/NotesPage";
import { NeuroAnalysisPage } from "../pages/NeuroAnalysisPage";
import { PaperUploadPage } from "../pages/PaperUploadPage";
import { ProfilePage } from "../pages/ProfilePage";
import { UserManagementPage } from "../pages/UserManagementPage";
import { SessionsPage } from "../pages/SessionsPage";
import { TestsPage } from "../pages/TestsPage";
import { VocabPage } from "../pages/VocabPage";
import { AuthPage } from "../pages/AuthPage";
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

  const visibleRoutes = useMemo(
    () => ROUTES.filter((r) => !r.managementOnly || me?.is_staff),
    [me?.is_staff]
  );

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
      case "grammarCheck":
        return <GrammarCheckPage />;
      case "aiExamGen":
        return <AIExamGeneratorPage />;
      case "speakingMode":
        return <SpeakingModePage />;
      case "sentenceMining":
        return <SentenceMiningPage />;
      case "multiplayerQuiz":
        return <MultiplayerQuizPage />;
      case "tests":
        return <TestsPage />;
      case "jlptExam":
        return <JLPTExamPage />;
      case "paperUpload":
        return me?.is_staff ? <PaperUploadPage /> : <DashboardPage />;
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
        return me?.is_staff ? <ImportsPage /> : <DashboardPage />;
      case "userManagement":
        return me?.is_staff ? <UserManagementPage /> : <DashboardPage />;
      default:
        return <DashboardPage />;
    }
  }, [route, me?.is_staff]);

  if (!me) {
    return <AuthPage />;
  }

  return (
    <div className="app app--authed"><SideMenu
      routes={visibleRoutes}
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
            {me.is_staff && <span className="pill pill--management">Management</span>}
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
