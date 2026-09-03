import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import NewMeeting from './pages/NewMeeting';
import MeetingResults from './pages/MeetingResults';
import ProjectList from './pages/ProjectList';
import ProjectDashboard from './pages/ProjectDashboard';
import ProjectRecords from './pages/ProjectRecords';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './lib/authContext';

function AuthedApp() {
  const { session, loading, signOut } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">ProjectIQ</h1>
        </header>
        <main>
          <Login />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">ProjectIQ</h1>
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
          <Link to="/" className="hover:text-slate-900">
            New Meeting
          </Link>
          <Link to="/projects" className="hover:text-slate-900">
            Projects
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">{session.user.email}</span>
          <button onClick={signOut} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
            Sign out
          </button>
        </nav>
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
