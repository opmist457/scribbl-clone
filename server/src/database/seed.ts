import { initDb, getDb, saveDb, closeDb } from './db';

interface WordEntry {
  word: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const wordsByCategory: Record<string, { easy: string[]; medium: string[]; hard: string[] }> = {
  Animals: {
    easy: ['cat', 'dog', 'fish', 'bird', 'cow', 'pig', 'duck', 'frog', 'bear', 'mouse'],
    medium: ['elephant', 'giraffe', 'penguin', 'dolphin', 'kangaroo', 'octopus', 'parrot', 'turtle', 'hamster', 'butterfly'],
    hard: ['chameleon', 'platypus', 'armadillo', 'porcupine', 'salamander', 'hippopotamus', 'rhinoceros', 'chimpanzee', 'flamingo', 'scorpion'],
  },
  Food: {
    easy: ['pizza', 'cake', 'egg', 'apple', 'bread', 'rice', 'milk', 'pie', 'soup', 'corn'],
    medium: ['hamburger', 'spaghetti', 'pancake', 'sandwich', 'chocolate', 'popcorn', 'cupcake', 'sausage', 'waffle', 'donut'],
    hard: ['avocado', 'croissant', 'guacamole', 'cinnamon', 'artichoke', 'asparagus', 'bruschetta', 'quesadilla', 'pepperoni', 'gingerbread'],
  },
  Objects: {
    easy: ['book', 'lamp', 'cup', 'key', 'ball', 'box', 'hat', 'bell', 'door', 'bed'],
    medium: ['umbrella', 'scissors', 'candle', 'compass', 'balloon', 'envelope', 'diamond', 'battery', 'magnet', 'pillow'],
    hard: ['chandelier', 'microscope', 'binoculars', 'hourglass', 'thermometer', 'trampoline', 'calculator', 'telescope', 'stethoscope', 'typewriter'],
  },
  Actions: {
    easy: ['run', 'jump', 'swim', 'eat', 'cry', 'fly', 'sing', 'kick', 'clap', 'wave'],
    medium: ['dancing', 'fishing', 'painting', 'reading', 'cooking', 'climbing', 'digging', 'juggling', 'sneezing', 'sleeping'],
    hard: ['skydiving', 'meditating', 'sleepwalking', 'breakdancing', 'somersault', 'yodeling', 'hitchhiking', 'bungee jumping', 'moonwalking', 'surfing'],
  },
  Places: {
    easy: ['house', 'school', 'park', 'beach', 'farm', 'zoo', 'church', 'store', 'pool', 'lake'],
    medium: ['hospital', 'airport', 'library', 'castle', 'volcano', 'pyramid', 'stadium', 'factory', 'aquarium', 'fountain'],
    hard: ['observatory', 'laboratory', 'skyscraper', 'lighthouse', 'colosseum', 'waterfall', 'cathedral', 'plantation', 'archipelago', 'monastery'],
  },
  Sports: {
    easy: ['golf', 'tennis', 'boxing', 'soccer', 'skiing', 'hockey', 'rugby', 'yoga', 'karate', 'polo'],
    medium: ['baseball', 'football', 'basketball', 'swimming', 'volleyball', 'wrestling', 'archery', 'bowling', 'surfing', 'fencing'],
    hard: ['badminton', 'bobsled', 'gymnastics', 'trampoline', 'waterpolo', 'lacrosse', 'triathlon', 'decathlon', 'snowboarding', 'paragliding'],
  },
  Professions: {
    easy: ['doctor', 'nurse', 'chef', 'pilot', 'farmer', 'judge', 'king', 'clown', 'baker', 'maid'],
    medium: ['teacher', 'dentist', 'fireman', 'soldier', 'painter', 'singer', 'waiter', 'cowboy', 'pirate', 'wizard'],
    hard: ['astronaut', 'architect', 'detective', 'conductor', 'bartender', 'pharmacist', 'lifeguard', 'librarian', 'electrician', 'blacksmith'],
  },
  Nature: {
    easy: ['tree', 'sun', 'moon', 'star', 'rain', 'leaf', 'rock', 'hill', 'seed', 'pond'],
    medium: ['flower', 'forest', 'river', 'island', 'desert', 'mountain', 'rainbow', 'glacier', 'jungle', 'canyon'],
    hard: ['avalanche', 'earthquake', 'constellation', 'stalactite', 'tumbleweed', 'quicksand', 'whirlpool', 'ecosystem', 'geysers', 'mushroom'],
  },
  Technology: {
    easy: ['phone', 'clock', 'radio', 'TV', 'mouse', 'lamp', 'fan', 'wire', 'plug', 'bulb'],
    medium: ['computer', 'keyboard', 'camera', 'printer', 'speaker', 'headphones', 'monitor', 'joystick', 'antenna', 'charger'],
    hard: ['satellite', 'projector', 'microchip', 'bluetooth', 'algorithm', 'hologram', 'motherboard', 'smartwatch', 'drone', 'touchscreen'],
  },
  Entertainment: {
    easy: ['drum', 'dice', 'card', 'game', 'song', 'film', 'show', 'joke', 'toys', 'mask'],
    medium: ['guitar', 'circus', 'puppet', 'karaoke', 'concert', 'theater', 'cartoon', 'musical', 'jukebox', 'arcade'],
    hard: ['ventriloquist', 'trampoline', 'rollercoaster', 'marionette', 'pantomime', 'discoball', 'kaleidoscope', 'fireworks', 'orchestra', 'xylophone'],
  },
  'Body Parts': {
    easy: ['eye', 'ear', 'nose', 'hand', 'foot', 'arm', 'leg', 'head', 'hair', 'lips'],
    medium: ['elbow', 'finger', 'tongue', 'shoulder', 'stomach', 'muscle', 'thumb', 'ankle', 'tooth', 'brain'],
    hard: ['eyebrow', 'skeleton', 'kneecap', 'vertebra', 'collarbone', 'intestine', 'ribcage', 'ligament', 'tonsils', 'appendix'],
  },
  Clothing: {
    easy: ['hat', 'shoe', 'sock', 'belt', 'coat', 'tie', 'boot', 'cap', 'vest', 'ring'],
    medium: ['jacket', 'gloves', 'helmet', 'sweater', 'apron', 'scarf', 'sandals', 'shorts', 'pajamas', 'hoodie'],
    hard: ['tuxedo', 'suspenders', 'overalls', 'cardigan', 'stilettos', 'monocle', 'cufflinks', 'sombrero', 'kimono', 'turban'],
  },
  Vehicles: {
    easy: ['car', 'bus', 'boat', 'bike', 'van', 'taxi', 'ship', 'sled', 'raft', 'cart'],
    medium: ['airplane', 'tractor', 'scooter', 'subway', 'canoe', 'rocket', 'sailboat', 'firetruck', 'unicycle', 'kayak'],
    hard: ['helicopter', 'submarine', 'ambulance', 'bulldozer', 'limousine', 'zeppelin', 'hovercraft', 'steamboat', 'snowmobile', 'catamaran'],
  },
  Weather: {
    easy: ['rain', 'snow', 'wind', 'sun', 'fog', 'ice', 'cold', 'hot', 'wet', 'hail'],
    medium: ['storm', 'thunder', 'rainbow', 'tornado', 'clouds', 'lightning', 'blizzard', 'drought', 'sunrise', 'sunset'],
    hard: ['hurricane', 'avalanche', 'monsoon', 'heatwave', 'frostbite', 'icicle', 'snowflake', 'whirlwind', 'thunderstorm', 'barometer'],
  },
  Music: {
    easy: ['drum', 'bell', 'song', 'band', 'harp', 'note', 'tune', 'beat', 'horn', 'flute'],
    medium: ['guitar', 'piano', 'violin', 'trumpet', 'ukulele', 'cello', 'banjo', 'cymbal', 'maracas', 'tambourine'],
    hard: ['saxophone', 'accordion', 'harmonica', 'xylophone', 'trombone', 'metronome', 'orchestra', 'conductor', 'microphone', 'synthesizer'],
  },
  Movies: {
    easy: ['hero', 'alien', 'ghost', 'robot', 'witch', 'shark', 'king', 'ninja', 'zombie', 'spy'],
    medium: ['cowboy', 'dragon', 'mermaid', 'vampire', 'monster', 'unicorn', 'gladiator', 'werewolf', 'dinosaur', 'superhero'],
    hard: ['frankenstein', 'transformer', 'lightsaber', 'delorean', 'godzilla', 'jurassic', 'inception', 'animation', 'paparazzi', 'stuntman'],
  },
  Household: {
    easy: ['bed', 'mop', 'cup', 'pan', 'pot', 'rug', 'tap', 'jar', 'bin', 'mat'],
    medium: ['fridge', 'mirror', 'pillow', 'window', 'drawer', 'toilet', 'shower', 'blanket', 'curtain', 'toaster'],
    hard: ['dishwasher', 'chandelier', 'bookshelf', 'fireplace', 'microwave', 'wardrobe', 'thermostat', 'wallpaper', 'doorbell', 'plunger'],
  },
};

async function seed(): Promise<void> {
  await initDb();
  const db = getDb();

  // Check if words already exist
  const results = db.exec('SELECT COUNT(*) as count FROM word_lists');
  const count = results.length > 0 ? (results[0].values[0][0] as number) : 0;

  if (count > 0) {
    console.log(`Database already has ${count} words. Clearing and re-seeding...`);
    db.run('DELETE FROM word_lists');
  }

  const allEntries: WordEntry[] = [];

  for (const [category, difficulties] of Object.entries(wordsByCategory)) {
    for (const [difficulty, words] of Object.entries(difficulties)) {
      for (const word of words) {
        allEntries.push({
          word,
          category,
          difficulty: difficulty as 'easy' | 'medium' | 'hard',
        });
      }
    }
  }

  // Insert all words
  for (const entry of allEntries) {
    db.run('INSERT INTO word_lists (word, category, difficulty) VALUES (?, ?, ?)', [entry.word, entry.category, entry.difficulty]);
  }

  saveDb();

  console.log(`✅ Seeded ${allEntries.length} words across ${Object.keys(wordsByCategory).length} categories.`);

  for (const [category, difficulties] of Object.entries(wordsByCategory)) {
    const total = difficulties.easy.length + difficulties.medium.length + difficulties.hard.length;
    console.log(`  📂 ${category}: ${total} words (E:${difficulties.easy.length} M:${difficulties.medium.length} H:${difficulties.hard.length})`);
  }

  closeDb();
}

seed().catch(console.error);
