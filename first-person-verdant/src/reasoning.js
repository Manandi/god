// An original game reasoning and knowledge check, not a clinical or standardized IQ test.
// Eight questions: five reasoning puzzles and three general knowledge.
export const QUESTIONS=[
  {kind:'reasoning',prompt:'What comes next? · 2, 4, 8, 16, ?',options:['24','30','32','36'],answer:2},
  {kind:'reasoning',prompt:'Hand is to glove as foot is to…',options:['Shoelace','Sock','Leg','Floor'],answer:1},
  {kind:'reasoning',prompt:'What comes next? · 3, 6, 11, 18, 27, ?',options:['36','38','40','44'],answer:1},
  {kind:'reasoning',prompt:'Five machines take five minutes to make five widgets. How long do 100 machines take to make 100?',options:['5 minutes','20 minutes','100 minutes','500 minutes'],answer:0},
  {kind:'reasoning',prompt:'A lily pad patch doubles every day and covers a lake on day 48. When was it half covered?',options:['Day 24','Day 36','Day 46','Day 47'],answer:3},
  {kind:'knowledge',prompt:'Which planet is closest to the Sun?',options:['Venus','Mercury','Mars','Earth'],answer:1},
  {kind:'knowledge',prompt:'What gas do plants take in from the air to make their food?',options:['Oxygen','Nitrogen','Carbon dioxide','Helium'],answer:2},
  {kind:'knowledge',prompt:'Water boils at sea level at…',options:['90 °C','100 °C','120 °C','212 °C'],answer:1}
];
export function canTakeReasoning(date=''){
  if(!date)return true;
  const previous=Date.parse(`${date}T00:00:00Z`);
  return !Number.isFinite(previous)||Date.now()-previous>=30*86400000;
}
