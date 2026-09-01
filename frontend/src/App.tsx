import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NewMeeting from './pages/NewMeeting';
import MeetingResults from './pages/MeetingResults';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">ProjectIQ</h1>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<NewMeeting />} />
            <Route path="/meetings/:meetingId/results" element={<MeetingResults />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
