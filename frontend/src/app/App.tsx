import { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AppLogo } from "../components/AppLogo";
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
import { AppearanceProvider, useAppearance } from "./state/appearance";
import { ROUTES, setRoute, useRoute } from "./state/route";
import { useMe, UserProvider } from "./state/user";
import { applyNeuroUiMode } from "./theme/neuro";
import { getLearningLabel } from "./labels";

function ThemeToggle() {
  const { appearance, saveAppearance } = useAppearance();
  const isDark = appearance.theme_mode !== "light";
  return (
    <button
      className="btn topbar__theme-btn"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => saveAppearance({ ...appearance, theme_mode: isDark ? "light" : "dark" })}
      style={{ padding: "6px 10px", fontSize: 15, lineHeight: 1 }}
    >
      {isDark ? "☀" : "◑"}
    </button>
  );
}

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
    return (
      <ErrorBoundary>
        <AuthPage />
      </ErrorBoundary>
    );
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
            <AppLogo size={28} />
            <div>
              <div className="topbar__title">{def.label}</div>
              <div className="topbar__sub">{def.description}</div>
            </div>
          </div>

          <div className="topbar__meta">
            <span className="pill">{me.profile.jlpt_level}</span>
            <span className="pill">{getLearningLabel(me.profile.learning_type, me.profile.ui_prefs)}</span>
            {me.is_staff && <span className="pill pill--management">Management</span>}
            <ThemeToggle />
            <button
              className="btn topbar__profile-btn"
              onClick={() => setRoute("profile")}
              title="Profile"
              style={{ padding: "6px 10px" }}
            >
              {me.first_name ? me.first_name[0].toUpperCase() : me.username[0].toUpperCase()}
            </button>
            <button className="btn" onClick={logout} style={{ padding: "6px 10px" }}>
              Logout
            </button>
          </div>
        </header>

        <main className="content">
          <ErrorBoundary key={route}>{page}</ErrorBoundary>
        </main>
        <FocusAudioWidget />
        <CompanionWidget />
        <QuickNoteButton />
      </div>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <AppWithAppearance />
      </UserProvider>
    </ErrorBoundary>
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
