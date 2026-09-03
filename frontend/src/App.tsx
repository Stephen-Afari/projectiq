import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import NewMeeting from './pages/NewMeeting';
import MeetingResults from './pages/MeetingResults';
import ProjectList from './pages/ProjectList';
import ProjectDashboard from './pages/ProjectDashboard';
import ProjectRecords from './pages/ProjectRecords';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './lib/authContext';

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
        P
      </span>
      <span className="text-lg font-semibold text-slate-900">ProjectIQ</span>
    </Link>
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
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <Wordmark />
        </header>
        <main>
          <Login />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          <Wordmark />

          {/* Full nav row from sm upward */}
          <nav className="hidden items-center gap-4 text-sm font-medium text-slate-600 sm:flex">
            <Link to="/" className="transition-colors hover:text-brand-600">
              New Meeting
            </Link>
            <Link to="/projects" className="transition-colors hover:text-brand-600">
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
          <nav className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm font-medium text-slate-600 sm:hidden">
            <Link to="/" onClick={() => setMenuOpen(false)} className="py-1">
              New Meeting
            </Link>
            <Link to="/projects" onClick={() => setMenuOpen(false)} className="py-1">
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
      <main>
        <Routes>
          <Route path="/" element={<NewMeeting />} />
          <Route path="/meetings/:meetingId/results" element={<MeetingResults />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/:id" element={<ProjectDashboard />} />
          <Route path="/projects/:id/:type" element={<ProjectRecords />} />
        </Routes>
      </main>
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
