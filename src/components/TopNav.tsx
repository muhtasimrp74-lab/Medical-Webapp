import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';
import { openSearch } from './SearchDialog';

const LINKS = [['/', 'Library'], ['/questions', 'Questions'], ['/practice', 'Practice'], ['/review', 'Review'], ['/stats', 'Stats'], ['/notes', 'Notes']] as const;

export function TopNav() {
  return (
    <header className="topnav">
      <NavLink to="/" className="brand"><img src="./icons/icon.svg" alt="" width="26" height="26" /> MedStudy</NavLink>
      <nav aria-label="Main">
        {LINKS.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
      </nav>
      <button className="icon-btn" onClick={openSearch} aria-label="Search (Ctrl/⌘ K)" title="Search (Ctrl/⌘ K)"><Icon name="search" /></button>
    </header>
  );
}
