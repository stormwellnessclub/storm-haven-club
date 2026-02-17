export interface ExerciseDefinition {
  id: string;
  name: string;
  bodyPart: BodyPart;
  targetMuscle: string;
  equipment: string;
  equipmentCategory: EquipmentCategory;
  defaultSets: number;
  defaultReps: number;
  defaultRest: number; // seconds
}

export type BodyPart = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Glutes' | 'Core';
export type EquipmentCategory = 'Machines' | 'Free Weights' | 'Cardio' | 'Functional' | 'Accessories' | 'Bodyweight';

export const BODY_PARTS: BodyPart[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core'];
export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = ['Machines', 'Free Weights', 'Cardio', 'Functional', 'Accessories', 'Bodyweight'];

export const exerciseLibrary: ExerciseDefinition[] = [
  // === CHEST ===
  { id: 'bench-press-barbell', name: 'Barbell Bench Press', bodyPart: 'Chest', targetMuscle: 'Pectoralis Major', equipment: 'Barbell & Bench', equipmentCategory: 'Free Weights', defaultSets: 4, defaultReps: 8, defaultRest: 90 },
  { id: 'bench-press-dumbbell', name: 'Dumbbell Bench Press', bodyPart: 'Chest', targetMuscle: 'Pectoralis Major', equipment: 'Dumbbells & Bench', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'incline-bench-press', name: 'Incline Barbell Press', bodyPart: 'Chest', targetMuscle: 'Upper Chest', equipment: 'Barbell & Incline Bench', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', bodyPart: 'Chest', targetMuscle: 'Upper Chest', equipment: 'Dumbbells & Incline Bench', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'chest-press-biostrength', name: 'Chest Press (BioStrength)', bodyPart: 'Chest', targetMuscle: 'Pectoralis Major', equipment: 'Technogym BioStrength', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'chest-press-selection', name: 'Chest Press (Selection)', bodyPart: 'Chest', targetMuscle: 'Pectoralis Major', equipment: 'Technogym Selection 700', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'pec-fly-machine', name: 'Pec Fly Machine', bodyPart: 'Chest', targetMuscle: 'Pectoralis Major', equipment: 'Technogym Selection 900', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'cable-chest-fly', name: 'Cable Chest Fly', bodyPart: 'Chest', targetMuscle: 'Pectoralis Major', equipment: 'Kinesis Heritage', equipmentCategory: 'Functional', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'dumbbell-fly', name: 'Dumbbell Fly', bodyPart: 'Chest', targetMuscle: 'Pectoralis Major', equipment: 'Dumbbells & Bench', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'push-ups', name: 'Push-Ups', bodyPart: 'Chest', targetMuscle: 'Pectoralis Major', equipment: 'None', equipmentCategory: 'Bodyweight', defaultSets: 3, defaultReps: 15, defaultRest: 60 },

  // === BACK ===
  { id: 'lat-pulldown-biostrength', name: 'Lat Pulldown (BioStrength)', bodyPart: 'Back', targetMuscle: 'Latissimus Dorsi', equipment: 'Technogym BioStrength', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'lat-pulldown-selection', name: 'Lat Pulldown (Selection)', bodyPart: 'Back', targetMuscle: 'Latissimus Dorsi', equipment: 'Technogym Selection 700', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'seated-row-biostrength', name: 'Seated Row (BioStrength)', bodyPart: 'Back', targetMuscle: 'Rhomboids', equipment: 'Technogym BioStrength', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'seated-row-selection', name: 'Seated Row (Selection)', bodyPart: 'Back', targetMuscle: 'Rhomboids', equipment: 'Technogym Selection 900', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'barbell-row', name: 'Barbell Bent-Over Row', bodyPart: 'Back', targetMuscle: 'Latissimus Dorsi', equipment: 'Barbell', equipmentCategory: 'Free Weights', defaultSets: 4, defaultReps: 8, defaultRest: 90 },
  { id: 'dumbbell-row', name: 'Single-Arm Dumbbell Row', bodyPart: 'Back', targetMuscle: 'Latissimus Dorsi', equipment: 'Dumbbell & Bench', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 60 },
  { id: 'cable-row-kinesis', name: 'Cable Row (Kinesis)', bodyPart: 'Back', targetMuscle: 'Rhomboids', equipment: 'Kinesis Heritage', equipmentCategory: 'Functional', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'deadlift', name: 'Barbell Deadlift', bodyPart: 'Back', targetMuscle: 'Erector Spinae', equipment: 'Barbell', equipmentCategory: 'Free Weights', defaultSets: 4, defaultReps: 6, defaultRest: 120 },
  { id: 'pull-ups', name: 'Pull-Ups', bodyPart: 'Back', targetMuscle: 'Latissimus Dorsi', equipment: 'Pull-Up Bar', equipmentCategory: 'Bodyweight', defaultSets: 3, defaultReps: 8, defaultRest: 90 },
  { id: 'face-pulls', name: 'Face Pulls', bodyPart: 'Back', targetMuscle: 'Rear Deltoids', equipment: 'Cable Machine', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 15, defaultRest: 60 },

  // === SHOULDERS ===
  { id: 'overhead-press-barbell', name: 'Barbell Overhead Press', bodyPart: 'Shoulders', targetMuscle: 'Deltoids', equipment: 'Barbell', equipmentCategory: 'Free Weights', defaultSets: 4, defaultReps: 8, defaultRest: 90 },
  { id: 'overhead-press-dumbbell', name: 'Dumbbell Shoulder Press', bodyPart: 'Shoulders', targetMuscle: 'Deltoids', equipment: 'Dumbbells', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'shoulder-press-biostrength', name: 'Shoulder Press (BioStrength)', bodyPart: 'Shoulders', targetMuscle: 'Deltoids', equipment: 'Technogym BioStrength', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'lateral-raise', name: 'Dumbbell Lateral Raise', bodyPart: 'Shoulders', targetMuscle: 'Lateral Deltoid', equipment: 'Dumbbells', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 15, defaultRest: 60 },
  { id: 'front-raise', name: 'Dumbbell Front Raise', bodyPart: 'Shoulders', targetMuscle: 'Anterior Deltoid', equipment: 'Dumbbells', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', bodyPart: 'Shoulders', targetMuscle: 'Posterior Deltoid', equipment: 'Dumbbells', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 15, defaultRest: 60 },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise (Kinesis)', bodyPart: 'Shoulders', targetMuscle: 'Lateral Deltoid', equipment: 'Kinesis Core', equipmentCategory: 'Functional', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'arnold-press', name: 'Arnold Press', bodyPart: 'Shoulders', targetMuscle: 'Deltoids', equipment: 'Dumbbells', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 90 },

  // === ARMS ===
  { id: 'barbell-curl', name: 'Barbell Curl', bodyPart: 'Arms', targetMuscle: 'Biceps', equipment: 'Barbell', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 60 },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', bodyPart: 'Arms', targetMuscle: 'Biceps', equipment: 'Dumbbells', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'hammer-curl', name: 'Hammer Curl', bodyPart: 'Arms', targetMuscle: 'Brachialis', equipment: 'Dumbbells', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'cable-curl-kinesis', name: 'Cable Curl (Kinesis)', bodyPart: 'Arms', targetMuscle: 'Biceps', equipment: 'Kinesis Heritage', equipmentCategory: 'Functional', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'arm-curl-biostrength', name: 'Arm Curl (BioStrength)', bodyPart: 'Arms', targetMuscle: 'Biceps', equipment: 'Technogym BioStrength', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', bodyPart: 'Arms', targetMuscle: 'Triceps', equipment: 'Cable Machine', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'overhead-tricep-ext', name: 'Overhead Tricep Extension', bodyPart: 'Arms', targetMuscle: 'Triceps', equipment: 'Dumbbell', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'skull-crushers', name: 'Skull Crushers', bodyPart: 'Arms', targetMuscle: 'Triceps', equipment: 'EZ Bar & Bench', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 60 },
  { id: 'dips', name: 'Dips', bodyPart: 'Arms', targetMuscle: 'Triceps', equipment: 'Dip Station', equipmentCategory: 'Bodyweight', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'concentration-curl', name: 'Concentration Curl', bodyPart: 'Arms', targetMuscle: 'Biceps', equipment: 'Dumbbell', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 12, defaultRest: 60 },

  // === LEGS ===
  { id: 'barbell-squat', name: 'Barbell Back Squat', bodyPart: 'Legs', targetMuscle: 'Quadriceps', equipment: 'Barbell & Squat Rack', equipmentCategory: 'Free Weights', defaultSets: 4, defaultReps: 8, defaultRest: 120 },
  { id: 'front-squat', name: 'Front Squat', bodyPart: 'Legs', targetMuscle: 'Quadriceps', equipment: 'Barbell & Squat Rack', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 8, defaultRest: 120 },
  { id: 'leg-press', name: 'Leg Press', bodyPart: 'Legs', targetMuscle: 'Quadriceps', equipment: 'Technogym Selection 900', equipmentCategory: 'Machines', defaultSets: 4, defaultReps: 10, defaultRest: 90 },
  { id: 'leg-extension-biostrength', name: 'Leg Extension (BioStrength)', bodyPart: 'Legs', targetMuscle: 'Quadriceps', equipment: 'Technogym BioStrength', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'leg-curl-biostrength', name: 'Leg Curl (BioStrength)', bodyPart: 'Legs', targetMuscle: 'Hamstrings', equipment: 'Technogym BioStrength', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'leg-extension-selection', name: 'Leg Extension (Selection)', bodyPart: 'Legs', targetMuscle: 'Quadriceps', equipment: 'Technogym Selection 700', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'leg-curl-selection', name: 'Leg Curl (Selection)', bodyPart: 'Legs', targetMuscle: 'Hamstrings', equipment: 'Technogym Selection 700', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'walking-lunges', name: 'Walking Lunges', bodyPart: 'Legs', targetMuscle: 'Quadriceps', equipment: 'Dumbbells', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', bodyPart: 'Legs', targetMuscle: 'Quadriceps', equipment: 'Dumbbells & Bench', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'calf-raise-standing', name: 'Standing Calf Raise', bodyPart: 'Legs', targetMuscle: 'Calves', equipment: 'Smith Machine', equipmentCategory: 'Machines', defaultSets: 4, defaultReps: 15, defaultRest: 45 },
  { id: 'rdl', name: 'Romanian Deadlift', bodyPart: 'Legs', targetMuscle: 'Hamstrings', equipment: 'Barbell', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'hack-squat-booty', name: 'Hack Squat (Booty Builder)', bodyPart: 'Legs', targetMuscle: 'Quadriceps', equipment: 'Booty Builder Hack Squat', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 10, defaultRest: 90 },

  // === GLUTES ===
  { id: 'hip-thrust-booty-v4', name: 'Hip Thrust (Booty Builder V4)', bodyPart: 'Glutes', targetMuscle: 'Gluteus Maximus', equipment: 'Booty Builder Platinum V4', equipmentCategory: 'Machines', defaultSets: 4, defaultReps: 12, defaultRest: 90 },
  { id: 'hip-thrust-booty-v8', name: 'Hip Thrust (Booty Builder V8)', bodyPart: 'Glutes', targetMuscle: 'Gluteus Maximus', equipment: 'Booty Builder V8.0', equipmentCategory: 'Machines', defaultSets: 4, defaultReps: 12, defaultRest: 90 },
  { id: 'glute-kickback-station', name: 'Glute Kickback (Station One)', bodyPart: 'Glutes', targetMuscle: 'Gluteus Maximus', equipment: 'Booty Builder Station One', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'belt-squat-booty', name: 'Belt Squat (Booty Builder)', bodyPart: 'Glutes', targetMuscle: 'Gluteus Maximus', equipment: 'Booty Builder Belt Squat', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 10, defaultRest: 90 },
  { id: 'cable-kickback', name: 'Cable Kickback (Kinesis)', bodyPart: 'Glutes', targetMuscle: 'Gluteus Maximus', equipment: 'Kinesis Heritage', equipmentCategory: 'Functional', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'sumo-deadlift', name: 'Sumo Deadlift', bodyPart: 'Glutes', targetMuscle: 'Gluteus Maximus', equipment: 'Barbell', equipmentCategory: 'Free Weights', defaultSets: 4, defaultReps: 8, defaultRest: 120 },
  { id: 'glute-bridge', name: 'Glute Bridge', bodyPart: 'Glutes', targetMuscle: 'Gluteus Maximus', equipment: 'None', equipmentCategory: 'Bodyweight', defaultSets: 3, defaultReps: 15, defaultRest: 60 },
  { id: 'abductor-machine', name: 'Hip Abduction Machine', bodyPart: 'Glutes', targetMuscle: 'Gluteus Medius', equipment: 'Technogym Selection 700', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 15, defaultRest: 60 },
  { id: 'step-ups', name: 'Dumbbell Step-Ups', bodyPart: 'Glutes', targetMuscle: 'Gluteus Maximus', equipment: 'Dumbbells & Box', equipmentCategory: 'Free Weights', defaultSets: 3, defaultReps: 10, defaultRest: 60 },

  // === CORE ===
  { id: 'plank', name: 'Plank', bodyPart: 'Core', targetMuscle: 'Rectus Abdominis', equipment: 'None', equipmentCategory: 'Bodyweight', defaultSets: 3, defaultReps: 60, defaultRest: 60 },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', bodyPart: 'Core', targetMuscle: 'Lower Abs', equipment: 'Pull-Up Bar', equipmentCategory: 'Bodyweight', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'cable-woodchop', name: 'Cable Woodchop (Kinesis)', bodyPart: 'Core', targetMuscle: 'Obliques', equipment: 'Kinesis Core', equipmentCategory: 'Functional', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'ab-crunch-biostrength', name: 'Ab Crunch (BioStrength)', bodyPart: 'Core', targetMuscle: 'Rectus Abdominis', equipment: 'Technogym BioStrength', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 15, defaultRest: 45 },
  { id: 'russian-twist', name: 'Russian Twist', bodyPart: 'Core', targetMuscle: 'Obliques', equipment: 'Medicine Ball', equipmentCategory: 'Accessories', defaultSets: 3, defaultReps: 20, defaultRest: 45 },
  { id: 'bicycle-crunch', name: 'Bicycle Crunch', bodyPart: 'Core', targetMuscle: 'Obliques', equipment: 'None', equipmentCategory: 'Bodyweight', defaultSets: 3, defaultReps: 20, defaultRest: 45 },
  { id: 'dead-bug', name: 'Dead Bug', bodyPart: 'Core', targetMuscle: 'Transverse Abdominis', equipment: 'None', equipmentCategory: 'Bodyweight', defaultSets: 3, defaultReps: 10, defaultRest: 45 },
  { id: 'pallof-press', name: 'Pallof Press', bodyPart: 'Core', targetMuscle: 'Obliques', equipment: 'Cable Machine', equipmentCategory: 'Machines', defaultSets: 3, defaultReps: 12, defaultRest: 60 },
  { id: 'ab-rollout', name: 'Ab Rollout', bodyPart: 'Core', targetMuscle: 'Rectus Abdominis', equipment: 'Ab Wheel', equipmentCategory: 'Accessories', defaultSets: 3, defaultReps: 10, defaultRest: 60 },

  // === CARDIO ===
  { id: 'treadmill-run', name: 'Treadmill Run (Skillrun)', bodyPart: 'Legs', targetMuscle: 'Cardiovascular', equipment: 'Technogym Skillrun', equipmentCategory: 'Cardio', defaultSets: 1, defaultReps: 1, defaultRest: 0 },
  { id: 'elliptical-synchro', name: 'Elliptical (Synchro AR)', bodyPart: 'Legs', targetMuscle: 'Cardiovascular', equipment: 'Technogym Synchro AR', equipmentCategory: 'Cardio', defaultSets: 1, defaultReps: 1, defaultRest: 0 },
  { id: 'stair-climber', name: 'Stair Climber (Climb)', bodyPart: 'Legs', targetMuscle: 'Cardiovascular', equipment: 'Technogym Climb', equipmentCategory: 'Cardio', defaultSets: 1, defaultReps: 1, defaultRest: 0 },
];

export function searchExercises(
  query: string,
  bodyPart?: BodyPart,
  equipmentCategory?: EquipmentCategory
): ExerciseDefinition[] {
  return exerciseLibrary.filter((ex) => {
    const matchesQuery = !query || ex.name.toLowerCase().includes(query.toLowerCase()) || ex.targetMuscle.toLowerCase().includes(query.toLowerCase()) || ex.equipment.toLowerCase().includes(query.toLowerCase());
    const matchesBodyPart = !bodyPart || ex.bodyPart === bodyPart;
    const matchesCategory = !equipmentCategory || ex.equipmentCategory === equipmentCategory;
    return matchesQuery && matchesBodyPart && matchesCategory;
  });
}
