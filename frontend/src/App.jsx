import { Routes, Route } from 'react-router-dom';
import Header from './components/Header.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import OptimizerPage from './pages/OptimizerPage.jsx';
import ScenariosPage from './pages/ScenariosPage.jsx';
import ComparePage from './pages/ComparePage.jsx';
import RuleProfilesPage from './pages/RuleProfilesPage.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/optimizer" element={<OptimizerPage />} />
          <Route path="/scenarios" element={<ScenariosPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/rules" element={<RuleProfilesPage />} />
        </Routes>
      </main>
    </div>
  );
}
