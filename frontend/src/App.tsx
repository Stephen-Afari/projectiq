import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import NewMeeting from './pages/NewMeeting';
import MeetingResults from './pages/MeetingResults';
import ProjectList from './pages/ProjectList';
import ProjectDashboard from './pages/ProjectDashboard';
import ProjectRecords from './pages/ProjectRecords';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './lib/authContext';
import { Logo } from './components/ui/Logo';

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">
        Intelligence · Automation · Excellence
      </p>
      <p className="mt-1 text-xs text-slate-400">© 2026 ProjectIQ</p>
    </footer>
  );
}

function AuthedApp() {
  const { session, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        <span className="mr-2 h-3 w-3 animate-pulse rounded-full bg-brand-500" />
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col bg-neutral">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <Link to="/">
            <Logo />
          </Link>
        </header>
        <main className="flex-1">
          <Login />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo className="hidden sm:block" />
            <Logo mark className="sm:hidden" />
          </Link>

          {/* Full nav row from sm upward */}
          <nav className="hidden items-center gap-4 text-sm font-medium sm:flex">
            <Link to="/" className="text-cyan transition-colors hover:text-brand-700">
              New Meeting
            </Link>
            <Link to="/projects" className="text-cyan transition-colors hover:text-brand-700">
              Projects
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">{session.user.email}</span>
            <button
              onClick={signOut}
              className="rounded border border-slate-300 px-2 py-1 text-xs transition-colors hover:bg-slate-50"
            >
              Sign out
            </button>
          </nav>

          {/* Menu toggle below sm */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="rounded border border-slate-300 p-1.5 text-slate-600 transition-colors hover:bg-slate-50 sm:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
              {menuOpen ? (
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              ) : (
                <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {/* Collapsed nav panel below sm */}
        {menuOpen && (
          <nav className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm font-medium sm:hidden">
            <Link to="/" onClick={() => setMenuOpen(false)} className="py-1 text-cyan">
              New Meeting
            </Link>
            <Link to="/projects" onClick={() => setMenuOpen(false)} className="py-1 text-cyan">
              Projects
            </Link>
            <span className="py-1 text-xs text-slate-400">{session.user.email}</span>
            <button
              onClick={signOut}
              className="w-fit rounded border border-slate-300 px-2 py-1 text-xs transition-colors hover:bg-slate-50"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<NewMeeting />} />
          <Route path="/meetings/:meetingId/results" element={<MeetingResults />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/:id" element={<ProjectDashboard />} />
          <Route path="/projects/:id/:type" element={<ProjectRecords />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthedApp />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
