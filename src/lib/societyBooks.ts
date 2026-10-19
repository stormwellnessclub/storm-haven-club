// Higher Self Society book selection vote — single source of truth for titles.
export const SOCIETY_BOOK_VOTE_SLUG = "hss-book-vote-2026-1";
/** Closes 11:59:59 PM Detroit time, Friday Oct 23, 2026 (EDT, UTC-4). Mirrored in the event_votes policy. */
export const SOCIETY_BOOK_VOTE_CLOSES_AT = new Date("2026-10-24T03:59:59Z");
export const isBookVoteOpen = (now: Date = new Date()) => now < SOCIETY_BOOK_VOTE_CLOSES_AT;

export interface SocietyBook {
  key: string;
  title: string;
  author: string;
  isbn: string;
  synopsis: string;
}

export const coverUrl = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

export const SOCIETY_BOOKS: SocietyBook[] = [
  { key: "48_laws_of_power", title: "The 48 Laws of Power", author: "Robert Greene", isbn: "9780140280197",
    synopsis: "An exploration of power, influence, and human behavior through historical stories and 48 strategies. Greene examines how people gain authority, navigate competition, and protect themselves from manipulation, raising questions about ambition, trust, and ethics." },
  { key: "breaking_the_habit", title: "Breaking the Habit of Being Yourself", author: "Joe Dispenza", isbn: "9781401938093",
    synopsis: "Explores how familiar thoughts, emotions, and behaviors can keep us repeating the same experiences. Through his approach to meditation and personal transformation, Dispenza encourages readers to recognize those patterns and practice new ways of thinking, feeling, and living." },
  { key: "becoming_supernatural", title: "Becoming Supernatural", author: "Joe Dispenza", isbn: "9781401953096",
    synopsis: "Explores meditation, consciousness, and the connection between mind and body. Combining personal accounts, spiritual practices, and his interpretations of scientific research, Dispenza presents his ideas about moving beyond perceived limitations and creating profound personal change." },
  { key: "atomic_habits", title: "Atomic Habits", author: "James Clear", isbn: "9780735211292",
    synopsis: "A practical guide to building good habits, breaking unwanted ones, and making small changes that accumulate over time. Clear explores how identity, environment, and everyday routines influence behavior, offering tools for creating consistency without relying solely on motivation." },
  { key: "mountain_is_you", title: "The Mountain Is You", author: "Brianna Wiest", isbn: "9781949759228",
    synopsis: "Examines self-sabotage and why we sometimes resist the changes we want most. Wiest explores the emotional needs beneath familiar patterns, encouraging readers to develop self-awareness, build resilience, and work through the internal obstacles that keep them feeling stuck." },
  { key: "courage_to_be_disliked", title: "The Courage to Be Disliked", author: "Ichiro Kishimi & Fumitake Koga", isbn: "9781501197277",
    synopsis: "Written as a conversation between a philosopher and a young man, this book explores identity, happiness, and freedom from others’ expectations. Drawing on Alfred Adler’s psychology, it challenges readers to reconsider approval-seeking, relationships, and the influence of the past on their choices today." },
  { key: "loving_what_is", title: "Loving What Is", author: "Byron Katie with Stephen Mitchell", isbn: "9781400045372",
    synopsis: "Introduces “The Work,” a process that uses four questions to examine thoughts and beliefs that cause distress. Through examples involving relationships and everyday challenges, Katie invites readers to consider alternative perspectives and explore how their interpretations affect their experience." },
  { key: "emotional_agility", title: "Emotional Agility", author: "Susan David", isbn: "9781592409495",
    synopsis: "Explores how to navigate difficult emotions without suppressing them or allowing them to dictate every decision. David offers an approach to recognizing emotional patterns, responding with greater flexibility, and making choices that align with personal values—even during uncertainty or change." },
  { key: "four_thousand_weeks", title: "Four Thousand Weeks: Time Management for Mortals", author: "Oliver Burkeman", isbn: "9780374159122",
    synopsis: "A thoughtful exploration of time, ambition, and the pressure to get everything done. Starting with the roughly four thousand weeks in an eighty-year life, Burkeman asks readers to reconsider productivity, accept their limits, and make room for what they find most meaningful." },
];
