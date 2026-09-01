import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import NewMeeting from './pages/NewMeeting';
import MeetingResults from './pages/MeetingResults';
import ProjectList from './pages/ProjectList';
import ProjectDashboard from './pages/ProjectDashboard';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">ProjectIQ</h1>
          <nav className="flex gap-4 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-slate-900">
              New Meeting
            </Link>
            <Link to="/projects" className="hover:text-slate-900">
              Projects
            </Link>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<NewMeeting />} />
            <Route path="/meetings/:meetingId/results" element={<MeetingResults />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:id" element={<ProjectDashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
