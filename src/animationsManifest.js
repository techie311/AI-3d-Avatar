// Animation manifest — curated from FBX analysis (scripts/analyze-fbx.js)
// 80 animations, all 60fps unless noted, T-pose trimmed where detected

export const ANIMATIONS_MANIFEST = [
  // ── IDLES ──────────────────────────────────────────────────────────────────
  { key: "breathing_idle",              file: "Breathing Idle.fbx",              displayName: "Breathing Idle",              fps: 60, duration: 9.92,  loop: true,  category: "idle",      description: "Gentle breathing idle — chest rises and falls, very calm" },
  { key: "idle_1",                      file: "Idle1.fbx",                       displayName: "Idle 1",                      fps: 60, duration: 8.33,  loop: true,  category: "idle",      description: "Natural standing idle — subtle weight shifts and micro-movements" },
  { key: "idle_2",                      file: "Idle2.fbx",                       displayName: "Idle 2",                      fps: 60, duration: 16.62, loop: true,  category: "idle",      description: "Longer relaxed standing idle — gentle body sway" },
  { key: "idle",                        file: "idle.fbx",                        displayName: "Idle",                        fps: 60, duration: 8.33,  loop: true,  category: "idle",      description: "Standard neutral standing idle pose" },
  { key: "happy_idle",                  file: "Happy Idle.fbx",                  displayName: "Happy Idle",                  fps: 60, duration: 1.98,  loop: true,  category: "idle",      description: "Happy upbeat idle — cheerful relaxed stand with positive energy" },
  { key: "weight_shift",                file: "weight shift.fbx",                displayName: "Weight Shift",                fps: 60, duration: 9.42,  loop: true,  category: "idle",      description: "Relaxed weight shifting side to side — casual waiting pose" },
  { key: "weight_shift_alt",            file: "Weight Shift (1).fbx",            displayName: "Weight Shift (Alt)",          fps: 60, duration: 9.42,  loop: true,  category: "idle",      description: "Relaxed weight shifting — alternative version with skin included" },
  { key: "action_to_idle",              file: "Action Idle To Standing Idle.fbx",displayName: "Action To Idle",              fps: 60, duration: 0.92,  loop: false, category: "idle",      description: "Short transition from active pose to natural standing idle" },
  { key: "kneeling_idle",               file: "Kneeling Idle.fbx",               displayName: "Kneeling Idle",               fps: 30, duration: 4.25,  loop: true,  category: "idle",      description: "Kneeling idle — resting on one knee, still posture" },
  { key: "laying_idle",                 file: "Laying Idle.fbx",                 displayName: "Laying Idle",                 fps: 60, duration: 2.12,  loop: true,  category: "idle",      description: "Laying down idle — resting on the ground" },
  { key: "victory_idle",                file: "Victory Idle.fbx",                displayName: "Victory Idle",                fps: 60, duration: 1.87,  loop: true,  category: "idle",      description: "Victory idle — triumphant pose with arms raised in celebration" },
  { key: "ready_to_fight_idle",         file: "ready to fight Idle.fbx",         displayName: "Ready To Fight Idle",         fps: 60, duration: 3.62,  loop: true,  category: "idle",      description: "Combat ready defensive idle — low stance, arms up, guarded" },
  { key: "catwalk_idle_twist",          file: "Catwalk Idle To Twist R.fbx",     displayName: "Catwalk Idle Twist",          fps: 60, duration: 2.17,  loop: false, category: "idle",      description: "Stylish catwalk idle with a confident twist to the right" },

  // ── TALKING / CONVERSATION ─────────────────────────────────────────────────
  { key: "talking",                     file: "Talking.fbx",                     displayName: "Talking",                     fps: 60, duration: 5.15,  loop: true,  category: "talking",   description: "Natural talking with expressive hand gestures — primary talking animation" },
  { key: "talking_2",                   file: "Talking 2.fbx",                   displayName: "Talking 2",                   fps: 60, duration: 5.92,  loop: true,  category: "talking",   description: "Talking variant 2 — different hand gesture rhythm and style" },
  { key: "talking_3",                   file: "Talking 3.fbx",                   displayName: "Talking 3",                   fps: 60, duration: 10.25, loop: true,  category: "talking",   description: "Longer talking animation variant 3 — varied gestures over full conversation" },

  // ── AGREEMENT / NOD ────────────────────────────────────────────────────────
  { key: "agreeing_1",                  file: "Agreeing1.fbx",                   displayName: "Agreeing 1",                  fps: 60, duration: 4.68,  loop: false, category: "reaction",  description: "Full-body agreeing — nodding with conversational hand gestures" },
  { key: "agreeing_2",                  file: "Agreeing2.fbx",                   displayName: "Agreeing 2",                  fps: 60, duration: 1.82,  loop: false, category: "reaction",  description: "Quick agreeing nod — compact short version" },
  { key: "acknowledging",               file: "acknowledging.fbx",               displayName: "Acknowledging",               fps: 60, duration: 1.92,  loop: false, category: "reaction",  description: "Subtle acknowledging gesture — slight head dip and body lean" },
  { key: "head_nod_yes",                file: "head nod yes.fbx",                displayName: "Head Nod Yes",                fps: 60, duration: 2.58,  loop: false, category: "reaction",  description: "Clear head nod yes — definitive agreement signal" },
  { key: "hard_head_nod",               file: "hard head nod.fbx",               displayName: "Hard Head Nod",               fps: 60, duration: 1.62,  loop: false, category: "reaction",  description: "Strong emphatic head nod — enthusiastic strong agreement" },
  { key: "hard_head_nod_alt",           file: "Hard Head Nod (1).fbx",           displayName: "Hard Head Nod (Alt)",         fps: 60, duration: 1.62,  loop: false, category: "reaction",  description: "Strong emphatic head nod — alternative version" },
  { key: "lengthy_head_nod",            file: "lengthy head nod.fbx",            displayName: "Lengthy Head Nod",            fps: 60, duration: 1.72,  loop: false, category: "reaction",  description: "Slow drawn-out head nod — thoughtful deliberate agreement" },
  { key: "lengthy_head_nod_alt",        file: "Lengthy Head Nod (1).fbx",        displayName: "Lengthy Head Nod (Alt)",      fps: 60, duration: 1.72,  loop: false, category: "reaction",  description: "Slow lengthy head nod — alternative version" },
  { key: "thoughtful_head_nod",         file: "Thoughtful Head Nod.fbx",         displayName: "Thoughtful Head Nod",         fps: 60, duration: 2.92,  loop: false, category: "reaction",  description: "Thoughtful slow head nod — pondering while acknowledging" },
  { key: "sarcastic_head_nod",          file: "sarcastic head nod.fbx",          displayName: "Sarcastic Head Nod",          fps: 60, duration: 2.33,  loop: false, category: "reaction",  description: "Exaggerated slow sarcastic nod — clearly insincere agreement" },
  { key: "sarcastic_head_nod_alt",      file: "Sarcastic Head Nod (1).fbx",      displayName: "Sarcastic Head Nod (Alt)",    fps: 60, duration: 2.33,  loop: false, category: "reaction",  description: "Sarcastic head nod — alternative version" },

  // ── DISAGREEMENT / SHAKE ───────────────────────────────────────────────────
  { key: "shaking_head_no",             file: "shaking head no.fbx",             displayName: "Shaking Head No",             fps: 60, duration: 1.80,  loop: false, category: "reaction",  description: "Shaking head no — clear direct disagreement or refusal" },
  { key: "shaking_head_no_alt",         file: "Shaking Head No (1).fbx",         displayName: "Shaking Head No (Alt)",       fps: 60, duration: 1.80,  loop: false, category: "reaction",  description: "Head shake no — alternative version" },
  { key: "annoyed_head_shake",          file: "annoyed head shake.fbx",          displayName: "Annoyed Head Shake",          fps: 60, duration: 2.55,  loop: false, category: "reaction",  description: "Annoyed head shake — frustrated disapproval" },
  { key: "annoyed_head_shake_alt",      file: "Annoyed Head Shake (1).fbx",      displayName: "Annoyed Head Shake (Alt)",    fps: 60, duration: 2.55,  loop: false, category: "reaction",  description: "Annoyed head shake — alternative version" },
  { key: "thoughtful_head_shake",       file: "thoughtful head shake.fbx",       displayName: "Thoughtful Head Shake",       fps: 60, duration: 3.05,  loop: false, category: "reaction",  description: "Thoughtful uncertain head shake — unsure or reconsidering" },
  { key: "thoughtful_head_shake_alt",   file: "Thoughtful Head Shake (1).fbx",   displayName: "Thoughtful Head Shake (Alt)", fps: 60, duration: 3.05,  loop: false, category: "reaction",  description: "Thoughtful uncertain head shake — alternative version" },

  // ── EMOTIONS / EXPRESSIONS ─────────────────────────────────────────────────
  { key: "happy",                       file: "Happy.fbx",                       displayName: "Happy",                       fps: 60, duration: 10.00, loop: false, category: "emotion",   description: "Happy joyful full-body reaction — arms spread, bright energy" },
  { key: "excited",                     file: "Excited.fbx",                     displayName: "Excited",                     fps: 60, duration: 6.55,  loop: false, category: "emotion",   description: "Excited bouncy reaction — jumping energy, arms raised" },
  { key: "laughing",                    file: "Laughing.fbx",                    displayName: "Laughing",                    fps: 60, duration: 9.75,  loop: false, category: "emotion",   description: "Laughing — body shakes with genuine laughter, hands on belly" },
  { key: "sad_idle",                    file: "Sad Idle.fbx",                    displayName: "Sad Idle",                    fps: 60, duration: 2.78,  loop: true,  category: "emotion",   description: "Sad drooped idle — dejected slouch, head down, arms limp" },
  { key: "sad_idle_2",                  file: "Sad Idle (1).fbx",                displayName: "Sad Idle 2",                  fps: 60, duration: 2.67,  loop: true,  category: "emotion",   description: "Sad idle variant 2 — different drooped posture" },
  { key: "sad_idle_3",                  file: "Sad Idle (2).fbx",                displayName: "Sad Idle 3",                  fps: 60, duration: 4.00,  loop: true,  category: "emotion",   description: "Sad idle variant 3 — longer melancholic standing pose" },
  { key: "surprised",                   file: "Surprised.fbx",                   displayName: "Surprised",                   fps: 60, duration: 3.98,  loop: false, category: "emotion",   description: "Surprised reaction — steps back, hands raised, eyes wide" },
  { key: "reacting",                    file: "Reacting.fbx",                    displayName: "Reacting",                    fps: 60, duration: 3.67,  loop: false, category: "emotion",   description: "Reacting with shock or surprise — dramatic full-body response" },
  { key: "bashful",                     file: "Bashful.fbx",                     displayName: "Bashful",                     fps: 60, duration: 11.00, loop: false, category: "emotion",   description: "Bashful shy gesture — fidgeting, looking down, embarrassed" },
  { key: "thankful",                    file: "Thankful.fbx",                    displayName: "Thankful",                    fps: 60, duration: 3.00,  loop: false, category: "emotion",   description: "Thankful grateful gesture — hands pressed to chest, warm bow" },
  { key: "relieved_sigh",               file: "relieved sigh.fbx",               displayName: "Relieved Sigh",               fps: 60, duration: 3.00,  loop: false, category: "emotion",   description: "Relieved sigh — shoulders drop, exhale of relief after tension" },
  { key: "joyful_jump",                 file: "Joyful Jump.fbx",                 displayName: "Joyful Jump",                 fps: 60, duration: 1.85,  loop: false, category: "emotion",   description: "Joyful jump — leaping in celebration" },

  // ── GESTURES ───────────────────────────────────────────────────────────────
  { key: "waving",                      file: "Waving.fbx",                      displayName: "Waving",                      fps: 60, duration: 0.53,  loop: true,  category: "gesture",   description: "Waving hello or goodbye — right hand raised, wrist wave" },
  { key: "waving_long",                 file: "Waving (1).fbx",                  displayName: "Waving (Long)",               fps: 60, duration: 3.17,  loop: false, category: "gesture",   description: "Longer waving animation — full arm raised wave greeting" },
  { key: "clapping",                    file: "Clapping.fbx",                    displayName: "Clapping",                    fps: 60, duration: 1.15,  loop: true,  category: "gesture",   description: "Clapping applause — both hands clapping together" },
  { key: "standing_clap",              file: "Standing Clap.fbx",               displayName: "Standing Clap",               fps: 60, duration: 4.42,  loop: false, category: "gesture",   description: "Standing clap — full applause with body movement" },
  { key: "thinking",                    file: "Thinking.fbx",                    displayName: "Thinking",                    fps: 60, duration: 4.23,  loop: false, category: "gesture",   description: "Thinking pose — right hand near chin, head tilted, pondering" },
  { key: "happy_hand_gesture",          file: "happy hand gesture.fbx",          displayName: "Happy Hand Gesture",          fps: 60, duration: 2.93,  loop: false, category: "gesture",   description: "Happy hand gesture — enthusiastic cheerful expressive hands" },
  { key: "happy_hand_gesture_alt",      file: "Happy Hand Gesture (1).fbx",      displayName: "Happy Hand Gesture (Alt)",    fps: 60, duration: 2.93,  loop: false, category: "gesture",   description: "Happy hand gesture — alternative version" },
  { key: "angry_gesture",              file: "angry gesture.fbx",               displayName: "Angry Gesture",               fps: 60, duration: 2.20,  loop: false, category: "gesture",   description: "Angry frustrated gesture — arm thrust, tense body language" },
  { key: "dismissing_gesture",         file: "dismissing gesture.fbx",          displayName: "Dismissing Gesture",          fps: 60, duration: 3.27,  loop: false, category: "gesture",   description: "Dismissive wave — brushing off, not interested" },
  { key: "look_away_gesture",          file: "look away gesture.fbx",           displayName: "Look Away Gesture",           fps: 60, duration: 2.33,  loop: false, category: "gesture",   description: "Looking away — turning head and body to avoid, uncomfortable" },
  { key: "standing_arguing",           file: "Standing Arguing.fbx",            displayName: "Standing Arguing",            fps: 60, duration: 20.78, loop: true,  category: "gesture",   description: "Animated arguing — emphatic pointing, gesturing, body leaning" },
  { key: "standing_arguing_2",         file: "Standing Arguing 2.fbx",          displayName: "Standing Arguing 2",          fps: 60, duration: 20.78, loop: true,  category: "gesture",   description: "Arguing variant 2 — different aggressive gesture style" },
  { key: "wave_hip_hop_dance",         file: "Wave Hip Hop Dance.fbx",          displayName: "Wave Hip Hop Dance",          fps: 60, duration: 1.17,  loop: true,  category: "gesture",   description: "Hip-hop wave dance move — stylish body wave motion" },

  // ── LOCOMOTION ─────────────────────────────────────────────────────────────
  { key: "walking_1",                   file: "Walking1.fbx",                    displayName: "Walking 1",                   fps: 60, duration: 1.37,  loop: true,  category: "walk",      description: "Natural walking cycle — normal forward walk" },
  { key: "walking_2",                   file: "Walking2.fbx",                    displayName: "Walking 2",                   fps: 60, duration: 0.95,  loop: true,  category: "walk",      description: "Walking cycle variant 2 — slightly different pace" },
  { key: "walking",                     file: "walking.fbx",                     displayName: "Walking",                     fps: 60, duration: 0.95,  loop: true,  category: "walk",      description: "Standard forward walk cycle" },
  { key: "walking_backwards",          file: "Walking Backwards.fbx",           displayName: "Walking Backwards",           fps: 60, duration: 0.97,  loop: true,  category: "walk",      description: "Walking backward cycle — retreating or stepping back" },
  { key: "backward_walking_turn",      file: "Backward Walking Turn.fbx",       displayName: "Backward Walking Turn",       fps: 60, duration: 1.97,  loop: false, category: "walk",      description: "Turning while walking backward" },
  { key: "female_start_walking",       file: "Female Start Walking.fbx",        displayName: "Female Start Walking",        fps: 60, duration: 1.87,  loop: false, category: "walk",      description: "Starting to walk — first step transition from idle" },
  { key: "female_stop_walking",        file: "Female Stop Walking.fbx",         displayName: "Female Stop Walking",         fps: 60, duration: 1.53,  loop: false, category: "walk",      description: "Stopping walk — decelerating to idle stance" },
  { key: "female_tough_walk",          file: "Female Tough Walk.fbx",           displayName: "Female Tough Walk",           fps: 60, duration: 2.62,  loop: true,  category: "walk",      description: "Confident tough walk — assertive powerful stride" },
  { key: "catwalk_walking",            file: "Catwalk Walking.fbx",             displayName: "Catwalk Walking",             fps: 60, duration: 1.17,  loop: true,  category: "walk",      description: "Stylish catwalk runway walk — model stride" },
  { key: "baseball_walk_out",          file: "Baseball Walk Out.fbx",           displayName: "Baseball Walk Out",           fps: 60, duration: 4.00,  loop: false, category: "walk",      description: "Confident walk-out stride — proud purposeful walk" },
  { key: "left_turn",                  file: "left turn.fbx",                   displayName: "Left Turn",                   fps: 60, duration: 1.17,  loop: false, category: "walk",      description: "Turning left — body pivots to the left while walking" },
  { key: "right_turn",                 file: "right turn.fbx",                  displayName: "Right Turn",                  fps: 60, duration: 1.17,  loop: false, category: "walk",      description: "Turning right — body pivots to the right while walking" },
  { key: "left_strafe",                file: "left strafe.fbx",                 displayName: "Left Strafe",                 fps: 60, duration: 0.67,  loop: true,  category: "walk",      description: "Strafing step sideways to the left" },
  { key: "right_strafe",               file: "right strafe.fbx",                displayName: "Right Strafe",                fps: 60, duration: 0.67,  loop: true,  category: "walk",      description: "Strafing step sideways to the right" },
  { key: "left_strafe_walk",           file: "left strafe walk.fbx",            displayName: "Left Strafe Walk",            fps: 60, duration: 0.92,  loop: true,  category: "walk",      description: "Full strafing walk to the left" },
  { key: "right_strafe_walk",          file: "right strafe walk.fbx",           displayName: "Right Strafe Walk",           fps: 60, duration: 0.92,  loop: true,  category: "walk",      description: "Full strafing walk to the right" },
  { key: "running",                    file: "running.fbx",                      displayName: "Running",                     fps: 60, duration: 0.70,  loop: true,  category: "walk",      description: "Running forward at speed" },
  { key: "injured_walk",               file: "Injured Walk.fbx",                displayName: "Injured Walk",                fps: 60, duration: 1.63,  loop: true,  category: "walk",      description: "Injured limping walk — hobbling with pain" },
  { key: "injured_walk_turn",          file: "Injured Walk Right Turn.fbx",     displayName: "Injured Walk Turn",           fps: 60, duration: 1.83,  loop: false, category: "walk",      description: "Injured character turning right while limping" },
  { key: "moonwalk",                   file: "Moonwalk.fbx",                    displayName: "Moonwalk",                    fps: 60, duration: 1.02,  loop: true,  category: "walk",      description: "Moonwalk dance move — sliding backward style" },
  { key: "jump",                       file: "jump.fbx",                        displayName: "Jump",                        fps: 60, duration: 1.67,  loop: false, category: "action",    description: "Jump in place — full body leap" },
  { key: "fall_flat",                  file: "Fall Flat.fbx",                   displayName: "Fall Flat",                   fps: 60, duration: 2.53,  loop: false, category: "action",    description: "Falling flat on face — tripping and hitting the ground" },
  { key: "being_cocky",               file: "being cocky.fbx",                 displayName: "Being Cocky",                 fps: 60, duration: 4.00,  loop: false, category: "gesture",   description: "Cocky confident gesture — smug attitude, chest puffed" },
];

/** Quick lookup by key */
export const ANIMATIONS_BY_KEY = Object.fromEntries(
  ANIMATIONS_MANIFEST.map(a => [a.key, a])
);

/** Group by category */
export const ANIMATIONS_BY_CATEGORY = ANIMATIONS_MANIFEST.reduce((acc, a) => {
  (acc[a.category] = acc[a.category] || []).push(a);
  return acc;
}, {});

/** Keys the AI can use when selecting an animation */
export const AI_ANIMATION_KEYS = ANIMATIONS_MANIFEST.map(a => a.key);
