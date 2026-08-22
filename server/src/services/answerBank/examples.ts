/**
 * What a good answer sounds like.
 *
 * The intake's hints say what to reach for and what to avoid, and they are not
 * enough. Somebody who has never been asked "tell me about a time you showed
 * initiative" does not have a wrong idea of the answer, they have no idea of
 * its SHAPE, and no amount of instruction fixes that. You have to show them one.
 *
 * Which runs straight into the doctrine that the model never writes an answer,
 * and it is worth being exact about why that is not a contradiction. The rule
 * exists because a resume-fed model writing a candidate's answer produces the
 * templated mush every commercial tool produces, in their name, about their
 * life, with details they cannot defend in the room. The danger is a plausible
 * answer ABOUT THEM that they will paste. So these are built to be unpastable:
 *
 *   1. Every one happens somewhere the reader almost certainly does not work.
 *      Nobody submits a story about a jammed forklift for a marketing role.
 *      The content cannot transfer. The shape transfers perfectly.
 *   2. They are shown in four labelled beats rather than as flowing prose, so
 *      what is on display is the STRUCTURE. Prose invites copying; a diagram
 *      of a story invites you to fill it with your own.
 *   3. They stay collapsed until asked for. Somebody who does not need one is
 *      never anchored by it, which is the other half of the risk.
 *
 * The four beats are not a writing device. They are exactly what auditAnswer
 * scores in interviewer.ts, so what a reader sees demonstrated is precisely
 * what the follow-up questions will chase them for. examples.test.ts asserts
 * every one of these passes that audit with a full score, which means we never
 * show somebody a model answer our own interviewer would push back on.
 */

/**
 * One worked example, in the four beats a usable story has.
 *
 * `where` is stated up front and deliberately unglamorous. It sets the reader's
 * expectation that an ordinary job is where these come from, which for somebody
 * whose entire Australian experience is a supermarket is the more important of
 * the two messages on the screen.
 */
export interface WorkedExample {
  where: string;
  situation: string;
  action: string;
  obstacle: string;
  outcome: string;
}

export const BEATS: { key: keyof Omit<WorkedExample, 'where'>; label: string }[] = [
  { key: 'situation', label: 'The scene' },
  { key: 'action', label: 'What I did' },
  { key: 'obstacle', label: 'What got in the way' },
  { key: 'outcome', label: 'How it ended' },
];

/** The four beats as one spoken paragraph, which is how an answer arrives. */
export const asParagraph = (e: WorkedExample): string =>
  [e.situation, e.action, e.obstacle, e.outcome].join(' ');

// ---------------------------------------------------------------- the examples

/**
 * Three per theme, from three different kinds of work, each one demonstrating
 * the specific wrong turn that theme's `avoid` line warns about.
 */
export const EXAMPLES: Record<string, WorkedExample[]> = {
  failure: [
    {
      where: 'Stocktake at a hardware store',
      situation: 'One night I was counting the plumbing aisle on my own before a stocktake.',
      action: 'I rushed the last two shelves because I wanted to get out on time, and I wrote the numbers straight onto the sheet without recounting.',
      obstacle: 'The problem was I had counted boxes instead of units, so the figure was out by about four hundred items and nobody found it until the audit.',
      outcome: 'I owned up to my manager the next morning and recounted the whole aisle myself. Since then I recount anything I did in the last half hour of a shift.',
    },
    {
      where: 'Café, morning shift',
      situation: 'This was my second week and I was on the coffee machine during the morning rush.',
      action: 'I took an order for a large oat latte and I did not write it on the cup, because I thought I would remember it.',
      obstacle: 'But three more orders came in behind it and I made it with regular milk. The customer was dairy intolerant and had told me so.',
      outcome: 'I apologised, remade it and told my supervisor what had happened rather than letting it go. Afterwards I wrote every modification on the cup, every time, even when it was quiet.',
    },
    {
      where: 'Aged care, kitchen assistant',
      situation: 'One afternoon I was doing the tea trolley round on my own for the first time.',
      action: 'I worked from memory instead of the dietary sheet because I thought I knew who was on thickened fluids.',
      obstacle: 'I got one resident wrong. She did not drink it, but it should never have been in front of her and that was my fault.',
      outcome: 'I reported it to the nurse straight away and filled in the form. In the end nothing came of it, but I take the sheet with me on every round now and I check it at each door.',
    },
  ],

  conflict: [
    {
      where: 'Warehouse pick-pack',
      situation: 'There was a supervisor on nights who I found really hard to work with.',
      action: 'I asked him for ten minutes at the end of a shift and I went through the pick list with him to show where the delays were coming from.',
      obstacle: 'He thought I was blaming his team and it got tense. He said the numbers were wrong before he had looked at them.',
      outcome: 'In the end he agreed to try splitting the aisle between two pickers for a week. It held, and after that he came to me first when something was running late.',
    },
    {
      where: 'Group assignment, second year',
      situation: 'On a group report last year one person wanted to submit a draft none of us had read.',
      action: 'I said I was not comfortable putting my name on something I had not seen, and I offered to read it that night so we were not holding it up.',
      obstacle: 'He took it as me not trusting him and stopped replying in the chat for two days, which put us close to the deadline.',
      outcome: 'I messaged him directly rather than in the group and we went through it on a call. We submitted a day early, and I learned to raise that kind of thing privately first.',
    },
    {
      where: 'Retail, service desk',
      situation: 'A colleague on the desk kept sending difficult refunds over to me instead of handling them.',
      action: 'I asked her about it while we were closing, and it turned out she had never been shown how to process a refund without a receipt.',
      obstacle: 'I had assumed for weeks that she was avoiding the hard ones. I was wrong about her and I had been short with her about it.',
      outcome: 'I showed her the override on the till that night. Afterwards she handled them herself, and I stopped deciding why somebody was doing something before asking them.',
    },
  ],

  pressure: [
    {
      where: 'Supermarket, Christmas Eve',
      situation: 'The worst one was Christmas Eve on the service desk, when we were two people down from four.',
      action: 'The first thing I did was open a second register for pickups only, because that was the queue that was blocking everyone else.',
      obstacle: 'Then the eftpos terminal dropped out and I had no time to call IT with a queue out the door.',
      outcome: 'I moved those customers to the front registers by hand and kept the pickup line moving. In the end we cleared it by six and my manager mentioned it at the next team meeting.',
    },
    {
      where: 'Commercial kitchen',
      situation: 'One Friday night we had a function of sixty come in on top of the normal service.',
      action: 'I stopped doing anything that was not going out in the next ten minutes and put all the entrees up first so the floor had something to run.',
      obstacle: 'The problem was the chef was on the mains and could not help me, so I was calling the order on my own for about forty minutes.',
      outcome: 'Everything went out, about fifteen minutes late at worst. Afterwards the chef asked me to run the pass on function nights.',
    },
    {
      where: 'Call centre, energy retailer',
      situation: 'During a billing error one week every second call was somebody angry about the same charge.',
      action: 'I wrote myself a short line explaining what had gone wrong and used it at the start of every call, so I was not thinking it through each time.',
      obstacle: 'It was hard because I still did not know when it would be fixed, and people wanted a date I could not give them.',
      outcome: 'I told them what I did know and offered to call back once I had a date, and I kept a list. In the end I got through about sixty calls that day without a single escalation.',
    },
  ],

  teamwork: [
    {
      where: 'Nursery, garden centre',
      situation: 'Before a spring sale we had to move about four hundred plants out to the front lot in one morning.',
      action: 'I could not have done that on my own, so I asked the two casuals to load while I sorted by variety at the other end.',
      obstacle: 'Halfway through, one of them had to go and cover the register, so the loading stopped and I had a pile building up behind me.',
      outcome: 'I switched to loading myself and got the third person out of the potting shed for an hour. In the end we finished before the doors opened.',
    },
    {
      where: 'Disability support, group home',
      situation: 'One evening a resident had a fall just as the shift was changing over.',
      action: 'I stayed with him and kept him talking while I asked the incoming staff member to ring the nurse and get the incident form.',
      obstacle: 'She was new and did not know where the forms were kept, so I had to talk her through it without leaving him.',
      outcome: 'The nurse came within twenty minutes and he was fine. Afterwards I showed her the folder and where the emergency numbers are, so the next person would not be stuck.',
    },
    {
      where: 'University society, event night',
      situation: 'I was on the committee for an end of semester event with about two hundred people coming.',
      action: 'I took the door and the ticket list because that was the part that would jam if nobody owned it, and I asked two others to handle the bar and the AV.',
      obstacle: 'The AV person did not turn up and nobody had his files, so we were forty minutes from doors with no music.',
      outcome: 'I found someone with a laptop and a phone hotspot and we ran it off a playlist. It was not what we planned but the night went ahead.',
    },
  ],

  customer: [
    {
      where: 'Phone shop',
      situation: 'One Saturday a man came in already angry because his phone had been sent away twice for the same fault.',
      action: 'I let him say the whole thing before I said anything, then I read the repair notes back to him so he knew I had actually looked.',
      obstacle: 'The trouble was I could not give him what he wanted, which was a new handset on the spot. That was not mine to approve.',
      outcome: 'I told him exactly that, and what I could do instead, which was a loan phone and a manager callback on the Monday. He took it. He came back in a month later and asked for me.',
    },
    {
      where: 'Hotel reception',
      situation: 'A guest arrived at eleven at night and we had no record of her booking.',
      action: 'I stopped searching the system in front of her and got her a seat and a glass of water first, then kept looking.',
      obstacle: 'She had booked through a third party and the reference did not match anything we had. I could not prove she was right and she could not prove it either.',
      outcome: 'I gave her a room and flagged it for the morning manager rather than argue at midnight. It turned out the booking had gone to our sister property.',
    },
    {
      where: 'Pharmacy counter',
      situation: 'An older customer came in most weeks and was upset that her script was not ready.',
      action: 'I asked her when she had dropped it in, and it turned out she had left it at the doctor and thought she had given it to us.',
      obstacle: 'It was awkward because she was certain she had handed it over, and telling her outright that she had not would have embarrassed her.',
      outcome: 'I rang the surgery and had them fax it through while she waited. In the end she got it that afternoon, and after that I always checked the tray with her at drop-off.',
    },
  ],

  leadership: [
    {
      where: 'Fast food, closing shift',
      situation: 'One night the shift supervisor went home sick an hour before close.',
      action: 'Nobody else stepped in, so I split the close between the three of us and took the till count myself because it was the part I knew.',
      obstacle: 'One of the others had never done the fryer clean and we were already going to be late out.',
      outcome: 'I did the count and then went and did the fryer with him rather than talk him through it. We got out twenty minutes late instead of an hour.',
    },
    {
      where: 'Tutoring, first-year maths',
      situation: 'I ran a study group of about six students in the weeks before the exam.',
      action: 'I stopped answering questions one at a time and started putting the problem on the whiteboard so we worked it as a group.',
      obstacle: 'Two of them were much further behind and were going quiet rather than say so in front of the others.',
      outcome: 'I started staying back fifteen minutes for whoever wanted it, without making it a thing. Both of them came, and both passed.',
    },
    {
      where: 'Cleaning contract, office building',
      situation: 'A new starter joined our night team and was put with me for her first week.',
      action: 'I showed her the floor order I use, which is top down, because otherwise you walk dirt back through what you have done.',
      obstacle: 'She had been told something different in the induction, so for two nights she was doing it the other way and we were both redoing work.',
      outcome: 'I rang the supervisor and asked which one was right rather than just overruling her. He backed the top down order and updated the induction sheet.',
    },
  ],

  initiative: [
    {
      where: 'Petrol station, night fill',
      situation: 'The drinks fridge was always empty by the morning shift and it annoyed me every single night.',
      action: 'Nobody asked me to, but I started counting what went out on a Friday and I found it was two brands doing most of it.',
      obstacle: 'When I suggested double-facing those two, the day manager said we did not have the fridge space, so it went nowhere for a fortnight.',
      outcome: 'I showed him the counts I had kept over three weekends and he agreed to try it. After that the morning shift stopped opening to an empty fridge.',
    },
    {
      where: 'Admin, real estate office',
      situation: 'When I started, the key cabinet had no system and people spent ten minutes looking for a set every open home.',
      action: 'I relabelled the whole cabinet by street rather than by property number, off my own back, over two quiet afternoons.',
      obstacle: 'The trouble was two agents had memorised the old numbers and did not want it changed, so for a week I kept both labels on.',
      outcome: 'They came round once they had used it a few times. It is still done that way and the new starters pick it up in a day.',
    },
    {
      where: 'Op shop, volunteer',
      situation: 'We threw out a lot of donated books because there was nowhere to put them.',
      action: 'I suggested a fifty cent table by the door instead of sorting them into the shelves, and I set it up myself on a Saturday.',
      obstacle: 'The manager was worried it would look untidy from the street, which was fair, so we trialled it for two weeks only.',
      outcome: 'It brought in about forty dollars a week and cleared the back room. In the end they kept it, and I built a sign for it.',
    },
  ],

  learning: [
    {
      where: 'Pathology collection',
      situation: 'I was put on the appointment system in my first week with almost no training on it.',
      action: 'I stayed twenty minutes after my shift for the first four days and worked through the booking screens on a test patient.',
      obstacle: 'The hard part was that nobody could tell me why some appointment types blocked out two slots, and I did not want to ask the same question three times.',
      outcome: 'I wrote my own one page cheat sheet and checked it with the senior collector. She asked me to leave a copy at the front desk for the next new person.',
    },
    {
      where: 'Landscaping crew',
      situation: 'I had never used a plate compactor before and was handed one on my second day.',
      action: 'I watched the leading hand do one pass, then I asked him to stand with me for my first one rather than pretending I was fine.',
      obstacle: 'It was heavier than it looked and I was fighting it down the slope, which is the wrong way to do it and I could not tell why.',
      outcome: 'He showed me to let it walk and only steer. By the end of that job I was doing the paths on my own.',
    },
    {
      where: 'Bookkeeping, small business',
      situation: 'The owner used a version of the software I had never touched and expected me to reconcile the first month.',
      action: 'I taught myself at home over a weekend using the free tutorials, and I practised on a copy of the file rather than the live one.',
      obstacle: 'The tutorials did not cover how she had set up her chart of accounts, which was nothing like the standard one.',
      outcome: 'I made a list of the ten accounts I could not place and went through them with her in half an hour. After that I did the reconciliation monthly on my own.',
    },
  ],

  priorities: [
    {
      where: 'Reception, medical practice',
      situation: 'One Monday the doctor was running an hour behind, the phones were going and a delivery arrived needing a signature.',
      action: 'I signed for the delivery and left it in the hall unopened, because that was the thirty second job, then I went back to the phones.',
      obstacle: 'What I had to drop was the recall letters that were due out that day. There was no way to do those and keep the front desk running.',
      outcome: 'I told the practice manager at lunch rather than letting her find out on Friday, and we sent them Tuesday. Nothing came of it because she knew in time.',
    },
    {
      where: 'Warehouse dispatch',
      situation: 'One Monday morning we had three trucks booked into the same two hour window and only one dock.',
      action: 'I loaded the one with the earliest delivery deadline first, then the one going furthest, because that driver had the least slack in his day.',
      obstacle: 'The third driver was waiting ninety minutes and was not happy, and he was the one who came every week.',
      outcome: 'I went out and told him where he was in the order and why, instead of leaving him guessing. He waited. Afterwards we started staggering the bookings.',
    },
    {
      where: 'Final semester, three deadlines',
      situation: 'I had two assignments and a group presentation due within four days of each other.',
      action: 'I did the group presentation first even though it was due last, because other people were waiting on my part of it.',
      obstacle: 'That meant one of the assignments got about half the time I wanted and I had to submit something I was not happy with.',
      outcome: 'I emailed the tutor beforehand rather than after, and asked for two days. She gave me one. I would make the same call again.',
    },
  ],

  detail: [
    {
      where: 'Bakery, wholesale orders',
      situation: 'One morning I was checking the dockets for the café deliveries before the van went out.',
      action: 'I noticed one order said twelve sourdough where that café had ordered six every week for a year, so I rang them rather than send it.',
      obstacle: 'It had already been signed off by the shift lead, so I was querying something somebody more senior had passed.',
      outcome: 'It turned out to be a typo and they wanted six. It would have been about sixty dollars of stock wasted and a café short of something else.',
    },
    {
      where: 'Lab, sample reception',
      situation: 'I was booking in a batch of samples on a Friday afternoon.',
      action: 'Two tubes had the same patient label but different collection times, and I double checked the request forms instead of assuming it was a duplicate.',
      obstacle: 'The forms were handwritten and hard to read, and the collector had already gone home for the weekend.',
      outcome: 'I flagged them and held the batch rather than guess. On the Monday it turned out to be two different patients with the same surname.',
    },
    {
      where: 'Payroll, casual timesheets',
      situation: 'I was entering timesheets for about thirty casuals one fortnight.',
      action: 'One came through with a shift that ran to twenty five hours, so I stopped and rang the venue manager instead of correcting it myself.',
      obstacle: 'He was certain the sheet was right, and it took a while to work out that two shifts had been written on one line.',
      outcome: 'We split it properly and the person got paid correctly. If I had just capped it at what looked sensible she would have been short about ninety dollars.',
    },
  ],

  change: [
    {
      where: 'Retail, mid-refit',
      situation: 'We were told on a Tuesday that the shop floor was being reconfigured that weekend, not in a month.',
      action: 'The first thing I did was photograph every planogram before anything moved, because I knew nobody would remember where things had been.',
      obstacle: 'The problem was half the team were rostered off, and the new layout drawings did not arrive until the Saturday morning.',
      outcome: 'I worked from my photos to fill the gaps and got my two aisles done by the Sunday. Afterwards the area manager asked me to send them to the other stores.',
    },
    {
      where: 'Childcare, room change',
      situation: 'I was moved from the toddler room to the babies room with a day of notice when someone resigned.',
      action: 'I came in early on the first morning and read every child\'s file before the parents arrived, particularly the allergies and the sleep routines.',
      obstacle: 'The trouble was the parents did not know me and drop-off is exactly the wrong time to be a stranger.',
      outcome: 'I introduced myself to each of them at the door on that first day. Within a fortnight it settled, and I stayed in that room for the year.',
    },
    {
      where: 'Delivery driving',
      situation: 'The company switched to a new routing app overnight and the old one stopped working.',
      action: 'I ran my first two drops on the new app against my own knowledge of the area, to see where it was sending me wrong before I trusted it.',
      obstacle: 'It was routing through a road that had been closed for months, and there was no way to report that in the app.',
      outcome: 'I told the dispatcher and he passed it up. In the end they added a manual block. I still check the first drop of the day against what I know.',
    },
  ],

  ethics: [
    {
      where: 'Bottle shop',
      situation: 'One evening a regular came in with his teenage son and asked me to serve the son.',
      action: 'I asked for the son\'s ID, the same as I would for anyone, even though I knew the father well and it was awkward.',
      obstacle: 'The easy thing would have been to serve him. Nobody would have known, the father was standing right there and it felt rude to refuse.',
      outcome: 'I said no and explained it was my licence as well as the shop\'s. He was annoyed that night and fine about it the following week.',
    },
    {
      where: 'Stocktake, clothing retail',
      situation: 'At the end of a stocktake we were about fifteen items short and it was close to knock-off.',
      action: 'I said I would rather recount the two aisles I had done than sign a sheet I was not sure about.',
      obstacle: 'Two others wanted to write it off as shrinkage, and they were not wrong that it was within tolerance. It would have been accepted.',
      outcome: 'I recounted and found eleven of them in a wrong bay. In the end it cost me forty minutes and the number we sent up was a true one.',
    },
    {
      where: 'Reception, allied health',
      situation: 'A patient\'s husband rang and asked me to confirm what her appointment had been for.',
      action: 'I told him I could not discuss it and offered to leave a message asking her to call him.',
      obstacle: 'He was clearly worried and said he was her next of kin, and it felt unkind to give him nothing.',
      outcome: 'I held the line and passed the message on. She rang him back that afternoon. It was not mine to give away, however reasonable he sounded.',
    },
  ],

  safety: [
    {
      where: 'Warehouse, loading dock',
      situation: 'One morning I noticed the guard rail on the mezzanine had been unbolted and left leaning against the wall.',
      action: 'I stopped what I was doing and reported it to the supervisor straight away rather than putting it back myself.',
      obstacle: 'It was in the way of the pallet run and I knew putting it back would slow everybody down for the rest of the shift.',
      outcome: 'They taped the area off and had a fitter refit it properly that afternoon. It turned out the bolts were stripped, which I would not have known.',
    },
    {
      where: 'Aged care, floors',
      situation: 'One Tuesday just before lunch I found a jug of water had gone over in the corridor between the lounge and the dining room.',
      action: 'I stood with it and sent the first person who walked past for a wet floor sign, because I was not leaving it unattended with residents about to come through.',
      obstacle: 'The trouble was I was already late taking someone to the bus, and standing there cost me about ten minutes.',
      outcome: 'The sign came, it got mopped, nobody walked through it. I was late for the bus and I would do the same again.',
    },
    {
      where: 'Commercial kitchen',
      situation: 'One service I saw a new kitchen hand carrying a stock pot of hot liquid on his own.',
      action: 'I took one side of it and walked it with him, and afterwards I showed him where the trolley was kept.',
      obstacle: 'It was busy and stopping to say something felt like making a fuss over what he clearly thought was normal.',
      outcome: 'He used the trolley after that. I mentioned it to the chef so it went into the next induction rather than staying between us.',
    },
  ],

  procedure: [
    {
      where: 'Pharmacy dispensary',
      situation: 'One afternoon a script came in for a medication that needed a second check before it went out.',
      action: 'I held it and waited for the pharmacist rather than handing it over, even though I had watched the same check done fifty times.',
      obstacle: 'She was on a consultation and the customer was waiting, and I could see him getting frustrated with me.',
      outcome: 'He waited about eight minutes. The check exists because the strength was similar to another one on the shelf, and that is exactly the mistake it is there to catch.',
    },
    {
      where: 'Security, retail centre',
      situation: 'On a night shift I found a fire door propped open with a bin.',
      action: 'I closed it, logged it, and checked the two other doors on that level in case it was a pattern.',
      obstacle: 'The cleaner who had propped it was doing it so she could get her trolley through, which was a real problem and closing the door did not solve it.',
      outcome: 'I logged that part too and suggested she be given a swipe fob. She got one the following week, and the door stayed shut.',
    },
    {
      where: 'Food production line',
      situation: 'One afternoon I found a batch that had sat five minutes over the temperature hold time.',
      action: 'I quarantined it and filled in the deviation form rather than letting it go through, because the process says the clock is the clock.',
      obstacle: 'The difficulty was it came to about two hundred units and the shift lead thought it was fine, and honestly it probably was.',
      outcome: 'QA tested it and released it in the end. I had wasted nothing, and the record showed I had followed the process rather than eyeballed it.',
    },
  ],
};

/**
 * For a question mined from the resume, where the difficulty is different: not
 * "which category" but "which of the hundred times I did this thing".
 */
export const SEED_EXAMPLES: WorkedExample[] = [
  {
    where: 'A resume line reading "handled customer enquiries"',
    situation: 'There was one Thursday where a customer came in about an order that had been wrong twice.',
    action: 'I pulled up both previous orders before I said anything, so I could see what had actually happened rather than ask her to explain it a third time.',
    obstacle: 'The problem was the second order had been entered by my own manager, so I had to raise it without it sounding like I was pointing at him.',
    outcome: 'I fixed it on the spot and told him afterwards what I had found. In the end we changed how we confirm phone orders.',
  },
  {
    where: 'A resume line reading "managed social media accounts"',
    situation: 'The first time I ran a post that actually did something was a Tuesday in about March.',
    action: 'I had noticed our best performing posts were the ones with a face in them, so I rewrote that week\'s post around a staff photo instead of the product shot.',
    obstacle: 'I did not have approval to change the creative and the photo was one I took on my phone, so it did not match the brand guidelines at all.',
    outcome: 'It did about four times the usual engagement. I showed my manager the numbers and after that we shot a set of proper staff photos.',
  },
  {
    where: 'A resume line reading "assisted with stock management"',
    situation: 'One delivery day in winter I was checking a pallet in against the invoice on my own.',
    action: 'I counted the cartons rather than trusting the pallet label, which is the slower way and the reason I found it.',
    obstacle: 'The problem was the label said forty and there were thirty six, and the driver was already back in the cab wanting his signature.',
    outcome: 'I asked him to wait while I recounted in front of him, then noted it on the docket before signing. We were credited for the four.',
  },
];

/** The worked examples for a question, by theme, falling back to the seed set. */
export function examplesFor(question: { kind?: string; themes?: string[] }): WorkedExample[] {
  const theme = (question.themes || [])[0];
  if (question.kind === 'gap' && theme && EXAMPLES[theme]) return EXAMPLES[theme];
  return SEED_EXAMPLES;
}
