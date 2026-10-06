const P: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
  menu: 'M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z',
  text: 'M9.2 5 4 19h2.2l1.2-3.4h5.2L13.8 19H16L10.8 5H9.2Zm-1.1 9.1L10 8.6l1.9 5.5H8.1ZM17 9h-1.8v2.2H13V13h2.2v2.2H17V13h2.2v-1.8H17V9Z',
  focus: 'M5 5h5v2H7v3H5V5Zm9 0h5v5h-2V7h-3V5ZM5 14h2v3h3v2H5v-5Zm12 0h2v5h-5v-2h3v-3Z',
  bookmark: 'M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1Zm1 2v12.1l4-2.7 4 2.7V5H8Z',
  bookmarkFill: 'M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1Z',
  left: 'm14.7 5.3-6.4 6.7 6.4 6.7 1.4-1.4L11.1 12l5-5.3-1.4-1.4Z',
  right: 'm9.3 5.3-1.4 1.4 5 5.3-5 5.3 1.4 1.4 6.4-6.7-6.4-6.7Z',
  image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v7.6l3.5-3.6 3 3 4-5L19 14V7H5Zm0 10h14v-.5L15.6 12l-4 5-3-3L5 17Zm10-8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  note: 'M5 4h14a1 1 0 0 1 1 1v10l-5 5H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v12h8v-4h4V6H6Zm2 3h8v2H8V9Z',
  close: 'm6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z',
  check: 'm9.5 16.2-4-4L4 13.7l5.5 5.5L20 8.7 18.5 7.3 9.5 16.2Z',
  download: 'M11 4h2v8.2l2.8-2.8 1.4 1.4-5.2 5.2-5.2-5.2 1.4-1.4 2.8 2.8V4ZM5 18h14v2H5v-2Z',
  upload: 'M12 4.8l5.2 5.2-1.4 1.4-2.8-2.8V17h-2V8.6l-2.8 2.8L6.8 10 12 4.8ZM5 18h14v2H5v-2Z',
  trash: 'M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm3 2v8h2v-8H9Zm4 0v8h2v-8h-2Z',
  figure: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v10h14V7H5Zm2 8 3-4 2 2.5 2.5-3.5L18 15H7Z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm2 2v9.2A3 3 0 0 1 8 15h9V7a1 1 0 0 0-1-1H7Zm1 11a1 1 0 0 0 0 2h9v-2H8Z',
  list: 'M4 6h2v2H4V6Zm4 0h12v2H8V6Zm-4 5h2v2H4v-2Zm4 0h12v2H8v-2Zm-4 5h2v2H4v-2Zm4 0h12v2H8v-2Z',
};
export function Icon({ name, size = 20 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={P[name]} fill="currentColor" />
    </svg>
  );
}
