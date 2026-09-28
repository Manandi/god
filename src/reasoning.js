// An original game reasoning check, not a clinical or standardized IQ test.
export const QUESTIONS=[
  {prompt:'What comes next? · 2, 4, 8, 16, ?',options:['24','30','32','36'],answer:2},
  {prompt:'What comes next? · 1, 1, 2, 3, 5, 8, ?',options:['11','12','13','15'],answer:2},
  {prompt:'Which does not belong?',options:['Square','Circle','Triangle','Cube'],answer:3},
  {prompt:'Hand is to glove as foot is to…',options:['Shoelace','Sock','Leg','Floor'],answer:1},
  {prompt:'What comes next? · 3, 6, 11, 18, 27, ?',options:['36','38','40','44'],answer:1},
  {prompt:'Five machines take five minutes to make five widgets. How long do 100 machines take to make 100?',options:['5 minutes','20 minutes','100 minutes','500 minutes'],answer:0},
  {prompt:'What comes next? · A, C, F, J, O, ?',options:['R','S','T','U'],answer:3},
  {prompt:'A lily pad patch doubles every day and covers a lake on day 48. When was it half covered?',options:['Day 24','Day 36','Day 46','Day 47'],answer:3}
];
export function canTakeReasoning(date=''){
  if(!date)return true;
  const previous=Date.parse(`${date}T00:00:00Z`);
  return !Number.isFinite(previous)||Date.now()-previous>=30*86400000;
}
