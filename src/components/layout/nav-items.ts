/**
 * The main navigation, shared by the header (inline from `lg`), the menu
 * panel on smaller screens and the footer. Written in the app: it is site
 * structure, not reference data.
 */
export type NavItem = { href: string; label: string };

export const navItems: NavItem[] = [
  { href: "/listings?deal=sale", label: "Buy" },
  { href: "/listings?deal=rent", label: "Rent" },
  { href: "/listings?category=commercial", label: "Commercial" },
  { href: "/listings?category=land", label: "Land" },
  { href: "/directory/agencies", label: "Agents" },
  // "Professionals" is the name people see for what the code and the addresses call the directory.
  { href: "/directory", label: "Professionals" },
];

/** Where professionals learn what an account gives them and register. */
export const professionalsLink: NavItem = { href: "/#for-professionals", label: "For professionals" };
