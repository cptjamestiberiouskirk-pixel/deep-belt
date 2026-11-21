export type DialogueChannel = 'character' | 'coach';
export type DialogueClip = `${'vance' | 'lin' | 'outpost' | 'osk' | 'coach'}-${string}`;

const characterClips: Readonly<Record<string, DialogueClip>> = {
  "Welcome to Harrow Station, Captain. Dock clamps locked green. Try not to scratch the paint.": 'vance-01',
  "Exchange desk is buying Ferrite Ore at 12 MARKS a unit today. Standard tariff applies.": 'vance-02',
  "Out in Belt Two there are rare crystals... and an outlaw pirate frigate lurking. Watch your 6.": 'vance-03',
  "If your hold feels cramped, the market sells an Expanded Hold: +500 m³, fitted to Slot 2 as soon as you buy it.": 'vance-04',
  "The market has a Light Cannon for 600 MARKS. Destroying that Belt Two pirate will earn you a 250 MARK bounty!": 'vance-05',
  "Neural injectors are active in the station terminal. Check the SKILLS tab to queue training in real time while you fly.": 'vance-06',
  "Welcome to Vael Station. Mind the dust. Or don't.": 'lin-01',
  "Refinery filters have been clogged for six months. Breathe shallow.": 'lin-02',
  "The pirate frigate in Vael Belt carries military-grade plating. Don't say I didn't warn you.": 'lin-03',
  "Aurite Ore fetches 30 MARKS a unit at the desk. Better than Ferrite, if you survive.": 'lin-04',
  "Outpost core online. Dock clamps engaged. You are the only pilot on the manifest.": 'outpost-01',
  "Four hardpoints are available. Open Build to install modules with Hull Plates, Thruster Coils, Sensor Cores and MARKS.": 'outpost-02',
  "Storage Bay, Refinery Annex, Fab Bay and Docking Ring are the modules this frame can carry.": 'outpost-03',
  "Varran here. Take a job or don't.": 'osk-01',
  "Logistics is drowning in requisitions. Drink some lukewarm coffee and get to work.": 'osk-02',
  "Station manager wants reports. I want eight uninterrupted hours of sleep.": 'osk-03',
  "Don't scratch the docking clamps on your way out.": 'osk-04',
  "We need bulk minerals. Bring 200 Ferrite Ore back here. Don't ask what it's for.": 'osk-05',
  "Ore's in the hopper. Here's your Marks. Try not to spend it on coffee.": 'osk-06',
  "Still waiting on that 200 Ferrite. Hopper won't fill itself.": 'osk-07',
  "That's 200 Ferrite in your hold. Complete the contract and the Marks are yours.": 'osk-08',
  "There's a nuisance frigate buzzing Belt Two. Go blow it up so logistics stops filing complaints.": 'osk-09',
  "Heard the explosion from here. Well done. Take your pay.": 'osk-10',
  "Pirate's still transmitting in Belt Two. Make it stop transmitting.": 'osk-11',
  "Heard the explosion from here. Complete the contract and collect your pay.": 'osk-12',
  "Last batch. Deliver 300 Ferrite Ore. The authority will sign off on your jump beacon credentials.": 'osk-13',
  "300 units will be transferred into the hopper. Here's your pay and the Gate Access Permit. The system Gate is unlocked now. Safe travels, or whatever.": 'osk-14',
  "Bring 300 Ferrite Ore so I can rubber-stamp your clearance papers.": 'osk-15',
  "300 Ferrite, finally. Complete the contract and I'll stamp your clearance.": 'osk-16',
  "Bring 50 Ferrite Ore from Belt One or Belt Two.": 'osk-17',
  "Suit yourself. There's plenty of work in the hopper.": 'osk-18',
  "Contract dropped. Requisitions won't file themselves.": 'osk-19',
  "150 Pyrox Ore from the Ash Drift. Don't get atomized.": 'osk-20',
  "Fifty rocks. Bonus posted. Don't spend it all on coffee.": 'osk-21',
  "You lived. Annoying. Take this.": 'osk-22',
  "You lived. Annoying. Hand over the 150 Pyrox Ore.": 'osk-23',
  "Still waiting on that 150 Pyrox Ore from the Ash Drift.": 'osk-24',
  "Here's your pay and the Gate Access Permit. The system Gate is unlocked now. Safe travels, or whatever.": 'osk-25',
  "The system Gate is unlocked now. Safe travels, or whatever.": 'osk-26',
  "I need raw survey material from the uncharted fringe. Bring 150 Pyrox Ore from the Ash Drift. Try not to get atomized.": 'osk-27',
};

export function characterClip(text: string): DialogueClip | undefined {
  return characterClips[text];
}

const coachSteps: readonly DialogueClip[] = [
  'coach-01', 'coach-02', 'coach-03', 'coach-04', 'coach-05', 'coach-06', 'coach-07',
];

// Rows are the target frequency, columns the laser frequency. A match resumes mining.
const tuningClips: readonly (readonly DialogueClip[])[] = [
  ['coach-04', 'coach-08', 'coach-09'],
  ['coach-10', 'coach-04', 'coach-11'],
  ['coach-12', 'coach-13', 'coach-04'],
];

export function coachClip(step: number, rockFrequency?: number, laserFrequency?: number) {
  if (step === 3 && rockFrequency && laserFrequency) {
    return tuningClips[rockFrequency - 1]?.[laserFrequency - 1] ?? coachSteps[step];
  }
  return coachSteps[step];
}
