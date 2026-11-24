// The submitted Summit team profiles, shared by the public and portal Team views.
// Paragraphs are kept as submitted, including the final Arpit update.

export type TeamLinkKey =
  | 'ai-playground'
  | 'art-literature'
  | 'biosphere'
  | 'marketing'
  | 'cadathon'
  | 'computer-science-presentations'
  | 'drama'
  | 'engineering-exhibits'
  | 'genetics'
  | 'health-sciences'
  | 'imaginex'
  | 'product-design'
  | 'psychology'
  | 'techverse-engineering';

export interface TeamMention {
  /** Exact wording to link without rewriting the surrounding paragraph. */
  text: string;
  target: TeamLinkKey;
}

export type TeamSection = 'organizers' | 'developers' | 'ambassadors' | 'eaf' | 'parents';

/** The Team page's sections, in display order. */
export const TEAM_SECTIONS: readonly { key: TeamSection; title: string }[] = [
  { key: 'organizers', title: 'Event Organizers' },
  { key: 'developers', title: 'Developers' },
  { key: 'ambassadors', title: 'Ambassadors' },
  { key: 'eaf', title: 'EAF Team' },
  { key: 'parents', title: 'Parent Volunteers' },
];

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  section: TeamSection;
  /** Listed first in its section (the ambassadors' leads). */
  leadsSection?: boolean;
  /** Square headshot under /public; members without one get the silhouette placeholder. */
  photo?: string;
  bio: string;
  affiliations: readonly TeamLinkKey[];
  /** Includes role-label aliases as well as the submitted paragraph wording. */
  mentions: readonly TeamMention[];
}

export const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    "id": "deep-shah",
    "name": "Deep Shah",
    "photo": "/team/deep-shah.jpg",
    "role": "Ambassador Lead; Engineering Exhibits Track Lead",
    "section": "ambassadors",
    "leadsSection": true,
    "bio": "The track I am leading for the Summit is the Engineering Exhibits track, where kids show their creations to a panel of judges. As an 11th grader that enjoys sports, I am allowing for people to do projects to solve any problem. Even in areas like playing golf, which is my hobby, I am planning on building a robot that helps individuals play better.",
    "affiliations": [
      "engineering-exhibits"
    ],
    "mentions": [
      {
        "text": "Engineering Exhibits",
        "target": "engineering-exhibits"
      }
    ]
  },
  {
    "id": "yusuf-othman",
    "name": "Yusuf Othman",
    "role": "Health Sciences Track Lead",
    "section": "ambassadors",
    "bio": "Hello everyone! My name is Yusuf Othman, and I am one of the two track leads for the Health Sciences Track at the EHS Summit 2027. I am currently a 10th grader at Emerald High. I love playing soccer, and I also do some swimming!",
    "affiliations": [
      "health-sciences"
    ],
    "mentions": [
      {
        "text": "Health Sciences Track",
        "target": "health-sciences"
      }
    ]
  },
  {
    "id": "rishi-krishnan",
    "name": "Rishi Krishnan",
    "photo": "/team/rishi-krishnan.jpg",
    "role": "Engineering Exhibits & CADathon Track Lead",
    "section": "ambassadors",
    "bio": "I am in 11th grade, and am leading the Engineering Exhibit and CADathon in the summit. Some of my hobbies include piano and playing chess. Within engineering, areas that I am passionate about include Computer-Aided Design, sustainability, and product design. One fun fact about me is that I love the San Francisco 49ers.",
    "affiliations": [
      "engineering-exhibits",
      "cadathon"
    ],
    "mentions": [
      {
        "text": "Engineering Exhibits",
        "target": "engineering-exhibits"
      },
      {
        "text": "Engineering Exhibit",
        "target": "engineering-exhibits"
      },
      {
        "text": "CADathon",
        "target": "cadathon"
      }
    ]
  },
  {
    "id": "theo-chourey",
    "name": "Theo Chourey",
    "role": "ImagineX Co-Discipline Lead; Art/Lit & Drama Track Lead",
    "section": "ambassadors",
    "bio": "Hello! My name is Theo Chourey, I'm a junior and a Co-Discipline Lead for ImagineX and Track Lead for Art/Lit and Drama. This is my second year working on the Emerald Summit. I’m a big fan of DC Comics and I love history, art and spend a lot of my free time reading.",
    "affiliations": [
      "imaginex",
      "art-literature",
      "drama"
    ],
    "mentions": [
      {
        "text": "ImagineX",
        "target": "imaginex"
      },
      {
        "text": "Art/Lit",
        "target": "art-literature"
      },
      {
        "text": "Drama",
        "target": "drama"
      }
    ]
  },
  {
    "id": "kashvi-gupta",
    "name": "Kashvi Gupta",
    "photo": "/team/kashvi-gupta.jpg",
    "role": "Computer Science Presentations Track Lead",
    "section": "ambassadors",
    "bio": "Hi, my name is Kashvi and I'm a junior at Emerald High School. For the Emerald summit, I am leading the computer science presentations track and I am really excited to see what people will construct through my track. For a little bit about me, one of my biggest hobbies is reading books, especially books in the fantasy genre.",
    "affiliations": [
      "computer-science-presentations"
    ],
    "mentions": [
      {
        "text": "computer science presentations track",
        "target": "computer-science-presentations"
      },
      {
        "text": "Computer Science Presentations",
        "target": "computer-science-presentations"
      },
      {
        "text": "Comp Sci Presentations",
        "target": "computer-science-presentations"
      }
    ]
  },
  {
    "id": "salma-othman",
    "name": "Salma Othman",
    "role": "BioSphere Discipline Lead",
    "section": "ambassadors",
    "bio": "Hi everyone! My name is Salma, and I am a Biosphere Discipline Lead for Emerald Summit 27'. I'm currently a junior and I hope to pursue a career in neurology or psychology in the future. In my free time, I enjoy reading, drawing, and spending time with my friends. I'm excited to help organize the Summit and create an engaging experience for all participants!",
    "affiliations": [
      "biosphere"
    ],
    "mentions": [
      {
        "text": "Biosphere",
        "target": "biosphere"
      }
    ]
  },
  {
    "id": "prisha-chandra",
    "name": "Prisha Chandra",
    "photo": "/team/prisha-chandra.jpg",
    "role": "Track Lead: AI Playground and Marketing",
    "section": "ambassadors",
    "bio": "Hi my name is Prisha and I'm a junior at Emerald High leading the Marketing Track and the AI Playground Track for Summit 2027! Some of my hobbies are cooking and a reading. A fun fact about me is that I've been swimming and dancing competitively for years and now I coach kids in the sports I love!",
    "affiliations": [
      "ai-playground",
      "marketing"
    ],
    "mentions": [
      {
        "text": "Marketing Track",
        "target": "marketing"
      },
      {
        "text": "Marketing",
        "target": "marketing"
      },
      {
        "text": "AI Playground Track",
        "target": "ai-playground"
      },
      {
        "text": "AI Playground",
        "target": "ai-playground"
      }
    ]
  },
  {
    "id": "anvitha-logaprabakaran",
    "name": "Anvitha Logaprabakaran",
    "role": "Genetics Track Lead",
    "section": "ambassadors",
    "bio": "For the Summit this year, I am one of the leads for the Genetics Track! Some hobbies I have are reading and hanging out with friends. I am in 9th grade, and a fun fact about about me is that I play the piano!",
    "affiliations": [
      "genetics"
    ],
    "mentions": [
      {
        "text": "Genetics Track",
        "target": "genetics"
      }
    ]
  },
  {
    "id": "aditya-pedapati",
    "name": "Aditya Pedapati",
    "role": "Psychology & Genetics Track Lead",
    "section": "ambassadors",
    "bio": "I am leading the psychology and genetics tracks. I play professional MLS Next Soccer. I am currently a freshman. A fun fact is that I used to be a top 200 player in Rocket League.",
    "affiliations": [
      "psychology",
      "genetics"
    ],
    "mentions": [
      {
        "text": "psychology",
        "target": "psychology"
      },
      {
        "text": "genetics",
        "target": "genetics"
      }
    ]
  },
  {
    "id": "nysha-singhal",
    "name": "Nysha Singhal",
    "role": "Event Organization Lead",
    "section": "organizers",
    "bio": "Hi! My name is Nysha, and I'm one of the Event Organization Leads! I'm currently a junior, and I love reading and making art. A fun fact about me is that I can spend hours getting lost in a good book!",
    "affiliations": [],
    "mentions": []
  },
  {
    "id": "arpit-kumar-panda",
    "name": "Arpit Kumar Panda",
    "role": "CADathon Track Lead",
    "section": "ambassadors",
    "bio": "Arpit is leading the Cadathon track at the Emerald Summit '27. He is in 11th grade and enjoys playing the Cello and for the school's orchestra. A fun fact about him is that he has lived in 4 states!",
    "affiliations": [
      "cadathon"
    ],
    "mentions": [
      {
        "text": "CADathon",
        "target": "cadathon"
      }
    ]
  },
  {
    "id": "riddhi-krishnan",
    "name": "Riddhi Krishnan",
    "photo": "/team/riddhi-krishnan.jpg",
    "role": "Event Organization Lead",
    "section": "organizers",
    "leadsSection": true,
    "bio": "My name is Riddhi, and I'm in 11th grade. I'm one of the event organization leads for Emerald Summit '27! When I'm not studying or planning the summit, I love to read, sing, play the piano, and listen to music. One fun fact about me is that my favorite movie is Tangled!",
    "affiliations": [],
    "mentions": []
  },
  {
    "id": "guhan-bala",
    "name": "Guhan Bala",
    "role": "Ambassador Lead; TechVerse Engineering Lead; Product Design Track Lead",
    "section": "ambassadors",
    "leadsSection": true,
    "bio": "Hi, i'm in 11th grade and this is my 3rd year being part of the Summit and 2nd year helping lead it, specifically the Product Design track. Some hobbies I have is tinkering with electronics and a fun fact is I was able to fix an iPhone 5s that way.",
    "affiliations": [
      "techverse-engineering",
      "product-design"
    ],
    "mentions": [
      {
        "text": "TechVerse Engineering",
        "target": "techverse-engineering"
      },
      {
        "text": "Product Design track",
        "target": "product-design"
      },
      {
        "text": "Product Design",
        "target": "product-design"
      }
    ]
  },
  // Placeholder bios (Nov 24, 2026); swap in each person's own when it comes in.
  {
    "id": "anushka",
    "name": "Anushka",
    "role": "Event Organization Lead",
    "section": "organizers",
    "bio": "One of the event organization leads for Emerald Summit '27.",
    "affiliations": [],
    "mentions": []
  },
{
    "id": "nihtahli-anand",
    "name": "Nihtahli Anand",
    "role": "Event Organization Lead",
    "section": "organizers",
    "bio": "One of the event organization leads for Emerald Summit '27.",
    "affiliations": [],
    "mentions": []
  },
{
    "id": "arjun-mahajan",
    "name": "Arjun Mahajan",
    "role": "Lead Developer",
    "section": "developers",
    "bio": "Co-leads development of the Emerald Summit website and app.",
    "affiliations": [],
    "mentions": []
  },
{
    "id": "akhil-muthyala",
    "name": "Akhil Muthyala",
    "role": "Lead Developer",
    "section": "developers",
    "bio": "Co-leads development of the Emerald Summit website and app.",
    "affiliations": [],
    "mentions": []
  },
{
    "id": "arush-singh",
    "name": "Arush Singh",
    "role": "Developer",
    "section": "developers",
    "bio": "Builds and tests the Emerald Summit website and app.",
    "affiliations": [],
    "mentions": []
  },
{
    "id": "mr-paliwal",
    "name": "Mr. Paliwal",
    "role": "President, EHS Academic Foundation",
    "section": "eaf",
    "bio": "President of the EHS Academic Foundation. He oversees all of its initiatives and likes to play cricket in his free time.",
    "affiliations": [],
    "mentions": []
  },
{
    "id": "ms-deepa",
    "name": "Ms. Deepa",
    "role": "EAF Board Member",
    "section": "eaf",
    "bio": "Serves on the EHS Academic Foundation board.",
    "affiliations": [],
    "mentions": []
  },
{
    "id": "veena",
    "name": "Veena",
    "role": "EAF Board Member",
    "section": "eaf",
    "bio": "Serves on the EHS Academic Foundation board.",
    "affiliations": [],
    "mentions": []
  },
{
    "id": "mr-anand",
    "name": "Mr. Anand",
    "role": "EAF Board Member",
    "section": "eaf",
    "bio": "Serves on the EHS Academic Foundation board.",
    "affiliations": [],
    "mentions": []
  }
];
