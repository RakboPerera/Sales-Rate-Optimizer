import { NavLink } from 'react-router-dom';
import Logo from './Logo.jsx';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/optimizer', label: 'Optimizer' },
  { to: '/scenarios', label: 'Scenarios' },
  { to: '/compare', label: 'Compare' },
  { to: '/rules', label: 'Rule Profiles' },
];

export default function Header() {
  return (
    <header className="app-header on-panel">
      <Logo variant="on-dark" size={22} />
      <span className="app-header-product">Sales Rate Optimizer</span>
      <nav className="app-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
