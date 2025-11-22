import React from 'react';
import { formatDate, validateEmail } from '@monorepo/shared';

function App() {
  const now = formatDate(new Date());
  return <div>Current time: {now}</div>;
}

export default App;
