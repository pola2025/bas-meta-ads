// Test ISO week number calculation

const dates = [
  '2025-11-17',
  '2025-11-20',
  '2025-11-23'
];

dates.forEach(dateStr => {
  const date = new Date(dateStr);

  // JavaScript calculation (similar to PostgreSQL)
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // ISO 8601 week calculation
  const tempDate = new Date(Date.UTC(year, month, day));
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(( ( (tempDate - yearStart) / 86400000) + 1)/7);
  const weekYear = tempDate.getUTCFullYear();

  console.log(`${dateStr}:`);
  console.log(`  Week Year: ${weekYear}`);
  console.log(`  Week Number: ${weekNo}`);
  console.log('');
});

console.log('---');
console.log('Period 2025-11-17 ~ 2025-11-20:');
console.log('  Uses week from: 2025-11-17');
console.log('');
console.log('Period 2025-11-17 ~ 2025-11-23:');
console.log('  Uses week from: 2025-11-17');
console.log('  => Should be THE SAME week number!');
