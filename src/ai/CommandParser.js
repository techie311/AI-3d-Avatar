/**
 * CommandParser — Parses structured AI responses into avatar commands
 * 
 * Expected AI response format:
 * {
 *   "text": "Hello there!",
 *   "emotion": "happy",
 *   "animation": "waving",
 *   "intensity": 0.8
 * }
 * 
 * Also handles plain text responses (fallback to neutral)
 */

const VALID_EMOTIONS = [
  'neutral', 'happy', 'sad', 'angry', 'surprised', 'relaxed',
  'amused', 'worried', 'disgusted', 'excited', 'bored', 'curious',
  'shy', 'confused'
];

// Procedural animations (AnimationController states)
export const PROCEDURAL_ANIMATIONS = new Set([
  'idle', 'talking', 'waving', 'nodding', 'shaking_head',
  'thinking', 'walking', 'excited', 'sad_idle', 'looking_around'
]);

// FBX animations — exact keys from animationsManifest.js (81 entries)
export const FBX_ANIMATIONS = new Set([
  // Idles
  'breathing_idle', 'idle_1', 'idle_2', 'idle', 'happy_idle', 'weight_shift',
  'weight_shift_alt', 'action_to_idle', 'kneeling_idle', 'laying_idle',
  'victory_idle', 'ready_to_fight_idle', 'catwalk_idle_twist',
  // Talking
  'talking', 'talking_2', 'talking_3',
  // Agreement / Nod
  'agreeing_1', 'agreeing_2', 'acknowledging', 'head_nod_yes', 'hard_head_nod',
  'hard_head_nod_alt', 'lengthy_head_nod', 'lengthy_head_nod_alt',
  'thoughtful_head_nod', 'sarcastic_head_nod', 'sarcastic_head_nod_alt',
  // Disagreement / Shake
  'shaking_head_no', 'shaking_head_no_alt', 'annoyed_head_shake',
  'annoyed_head_shake_alt', 'thoughtful_head_shake', 'thoughtful_head_shake_alt',
  // Emotions
  'happy', 'excited', 'laughing', 'sad_idle', 'sad_idle_2', 'sad_idle_3',
  'surprised', 'reacting', 'bashful', 'thankful', 'relieved_sigh', 'joyful_jump',
  // Gestures
  'waving', 'waving_long', 'clapping', 'standing_clap', 'thinking',
  'happy_hand_gesture', 'happy_hand_gesture_alt', 'angry_gesture',
  'dismissing_gesture', 'look_away_gesture', 'standing_arguing',
  'standing_arguing_2', 'wave_hip_hop_dance', 'being_cocky',
  // Locomotion
  'walking_1', 'walking_2', 'walking', 'walking_backwards', 'backward_walking_turn',
  'female_start_walking', 'female_stop_walking', 'female_tough_walk',
  'catwalk_walking', 'baseball_walk_out', 'left_turn', 'right_turn',
  'left_strafe', 'right_strafe', 'left_strafe_walk', 'right_strafe_walk',
  'running', 'injured_walk', 'injured_walk_turn', 'moonwalk',
  // Actions
  'jump', 'fall_flat',
]);

/**
 * Alias map — translates common alternative names / AI hallucinations
 * to the correct manifest key. This is critical for robustness:
 * the AI may invent reasonable-sounding key names that don't exactly match.
 */
export const ANIMATION_ALIASES = {
  // Old/wrong keys → correct manifest keys
  'waving_gesture':    'waving',
  'thinking_gesture':  'thinking',
  'shrug':             'dismissing_gesture',
  'shrugging':         'dismissing_gesture',
  'walk_1':            'walking_1',
  'walk_2':            'walking_2',
  'silly_walk':        'moonwalk',
  'sad_to_idle':       'action_to_idle',
  'crying':            'sad_idle',
  'being_angry':       'angry_gesture',
  'terrified':         'surprised',
  'depressed_idle':    'sad_idle_2',
  'defeated':          'sad_idle_3',
  'salute':            'waving',
  'ymca':              'wave_hip_hop_dance',
  'thank_you':         'thankful',
  'look_away':         'look_away_gesture',
  'look_at_watch':     'thinking',
  'slow_walk':         'walking',
  'walk_forward':      'walking',
  'walk_backward':     'walking_backwards',
  'walk_left':         'left_strafe_walk',
  'walk_right':        'right_strafe_walk',
  'catwalk':           'catwalk_walking',
  'shuffle_left':      'left_strafe',
  'shuffle_right':     'right_strafe',
  'strafe_left':       'left_strafe',
  'strafe_right':      'right_strafe',
  'jogging':           'running',
  'jog_forward':       'running',
  'jog_backward':      'walking_backwards',
  'sneaking':          'walking',
  'crouch_walk':       'walking',
  'standing_up':       'action_to_idle',
  // Extra aliases for natural language
  'nod':               'head_nod_yes',
  'nod_yes':           'head_nod_yes',
  'shake_head':        'shaking_head_no',
  'head_shake':        'shaking_head_no',
  'wave':              'waving',
  'clap':              'clapping',
  'run':               'running',
  'argue':             'standing_arguing',
  'dance':             'wave_hip_hop_dance',
  'laugh':             'laughing',
  'cry':               'sad_idle',
  'sigh':              'relieved_sigh',
  'jump_joy':          'joyful_jump',
  'celebrate':         'victory_idle',
  'fight':             'ready_to_fight_idle',
  'dismiss':           'dismissing_gesture',
  'angry':             'angry_gesture',
  'react':             'reacting',
  'bash':              'bashful',
  'cocky':             'being_cocky',
};

const VALID_ANIMATIONS = new Set([...PROCEDURAL_ANIMATIONS, ...FBX_ANIMATIONS, ...Object.keys(ANIMATION_ALIASES)]);

/**
 * Resolve an animation key through the alias map.
 * Returns the canonical manifest key if an alias exists, otherwise returns the input.
 */
export function resolveAnimationKey(key) {
  if (!key) return key;
  // Already a valid FBX or procedural key
  if (FBX_ANIMATIONS.has(key) || PROCEDURAL_ANIMATIONS.has(key)) return key;
  // Check alias map
  return ANIMATION_ALIASES[key] || key;
}

export class CommandParser {
  /**
   * Parse raw AI response into a structured command
   * @param {string} rawResponse — raw text from the AI
   * @returns {Object} — { text, emotion, animation, intensity }
   */
  parse(rawResponse) {
    if (!rawResponse || rawResponse.trim().length === 0) {
      return this._defaultCommand();
    }

    let trimmed = rawResponse.trim();

    // Strip markdown code fences — LLMs often wrap JSON in ```json ... ```
    trimmed = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    // Strip bare "json" word prefix that some models emit (e.g. "json\n{...}")
    trimmed = trimmed.replace(/^json\s+/i, '').trim();

    // Try to extract JSON from the response
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return this._validateCommand(parsed);
      } catch {
        // JSON parse failed — try to extract structured data from text
        return this._parseFromText(trimmed);
      }
    }

    // No JSON found — treat entire response as plain text
    return this._parseFromText(trimmed);
  }

  /**
   * Validate and normalize a parsed command object
   */
  _validateCommand(parsed) {
    const command = {
      text: '',
      emotion: 'neutral',
      animation: 'talking',
      intensity: 0.8,
    };

    // Extract text
    if (typeof parsed.text === 'string') {
      command.text = parsed.text.trim();
    } else if (typeof parsed.message === 'string') {
      command.text = parsed.message.trim();
    } else if (typeof parsed.speech === 'string') {
      command.text = parsed.speech.trim();
    }

    // Extract emotion
    if (typeof parsed.emotion === 'string') {
      const emotion = parsed.emotion.toLowerCase().trim();
      if (VALID_EMOTIONS.includes(emotion)) {
        command.emotion = emotion;
      } else {
        // Try to fuzzy match
        command.emotion = this._fuzzyMatchEmotion(emotion);
      }
    }

    // Extract animation
    if (typeof parsed.animation === 'string') {
      let anim = parsed.animation.toLowerCase().trim().replace(/\s+/g, '_');
      // Resolve through alias map
      anim = resolveAnimationKey(anim);
      if (FBX_ANIMATIONS.has(anim) || PROCEDURAL_ANIMATIONS.has(anim)) {
        command.animation = anim;
      } else {
        // Auto-select animation based on emotion if animation is invalid
        command.animation = this._emotionToAnimation(command.emotion);
      }
    } else {
      // No animation specified — pick one based on emotion
      command.animation = this._emotionToAnimation(command.emotion);
    }

    // Extract intensity
    if (typeof parsed.intensity === 'number') {
      command.intensity = Math.max(0, Math.min(1, parsed.intensity));
    }

    // If no text was found, use the raw text minus JSON
    if (!command.text) {
      command.text = "...";
    }

    // Strip "json" prefix that some LLMs put inside the text field itself
    command.text = command.text.replace(/^json\s*/i, '').trim();
    if (!command.text) command.text = "...";

    return command;
  }

  /**
   * Parse command from plain text (non-JSON response)
   */
  _parseFromText(text) {
    // Remove any markdown formatting
    let cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
      .replace(/\*(.*?)\*/g, '$1')      // Italic
      .replace(/```[\s\S]*?```/g, '')   // Code blocks
      .trim();

    // Try to detect emotion from text content
    const emotion = this._detectEmotionFromText(cleanText);
    const animation = this._emotionToAnimation(emotion);

    return {
      text: cleanText || '...',
      emotion,
      animation,
      intensity: 0.7,
    };
  }

  /**
   * Detect emotion from text content (keyword analysis)
   */
  _detectEmotionFromText(text) {
    const lower = text.toLowerCase();

    const emotionKeywords = {
      happy:     ['happy', 'glad', 'great', 'wonderful', 'awesome', 'love', 'excited', 'yay', '!', 'haha', 'lol', '😊', '😄'],
      sad:       ['sad', 'sorry', 'unfortunately', 'miss', 'lonely', 'depressed', 'sigh', '😢', '😞'],
      angry:     ['angry', 'mad', 'furious', 'annoyed', 'hate', 'ugh', 'frustrated', '😡', '😤'],
      surprised: ['wow', 'whoa', 'really', 'no way', 'amazing', 'incredible', 'oh my', '😱', '😲'],
      curious:   ['hmm', 'interesting', 'wonder', 'curious', 'what if', 'tell me', '🤔'],
      confused:  ['confused', 'don\'t understand', 'what do you mean', 'huh', '😕'],
      excited:   ['excited', 'can\'t wait', 'amazing', 'let\'s go', 'woohoo', '🎉'],
      relaxed:   ['relax', 'chill', 'peaceful', 'calm', 'nice', 'cozy', '😌'],
    };

    let bestEmotion = 'neutral';
    let bestScore = 0;

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lower.includes(keyword)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestEmotion = emotion;
      }
    }

    return bestEmotion;
  }

  /**
   * Map emotion to a fitting default animation (uses ONLY real manifest keys)
   */
  _emotionToAnimation(emotion) {
    const map = {
      neutral:   'talking',
      happy:     'talking_2',
      sad:       'sad_idle',
      angry:     'angry_gesture',
      surprised: 'surprised',
      relaxed:   'breathing_idle',
      amused:    'laughing',
      worried:   'thinking',
      disgusted: 'shaking_head_no',
      excited:   'excited',
      bored:     'weight_shift',
      curious:   'thinking',
      shy:       'bashful',
      confused:  'dismissing_gesture',
    };
    return map[emotion] || 'talking';
  }

  /**
   * Fuzzy match an emotion string
   */
  _fuzzyMatchEmotion(input) {
    const input_lower = input.toLowerCase();
    // Check for partial matches
    for (const emotion of VALID_EMOTIONS) {
      if (emotion.includes(input_lower) || input_lower.includes(emotion)) {
        return emotion;
      }
    }
    return 'neutral';
  }

  _defaultCommand() {
    return {
      text: '...',
      emotion: 'neutral',
      animation: 'idle',
      intensity: 0.5,
    };
  }
}
