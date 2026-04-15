/**
 * AutonomousBehavior — Makes the avatar proactively talk and act
 * 
 * Triggers:
 * - Idle timeout (user silent for too long)
 * - Tab visibility changes (user returns)
 * - Time-based (periodic commentary)
 * - Mood-driven (mood reaches threshold)
 */

export class AutonomousBehavior {
  constructor(aiBridge, orchestrator, moodEngine, commandParser) {
    this.ai = aiBridge;
    this.orchestrator = orchestrator;
    this.mood = moodEngine;
    this.parser = commandParser;

    this.enabled = true;
    this.running = false;
    this.timeSinceLastAutoTalk = 0;
    this.timeSinceUserActivity = 0;
    this.checkInterval = 5; // Check triggers every 5 seconds
    this.checkTimer = 0;

    // Configuration (adjustable)
    this.config = {
      idleTimeout: 45,           // Seconds of silence before auto-talk
      minAutoTalkGap: 30,        // Minimum seconds between auto-talks
      periodicInterval: 120,     // Random commentary interval
      moodThreshold: 0.7,        // Mood must be above this to trigger mood-based talk
    };

    // Track tab visibility
    this._setupVisibilityTracking();
    this._setupAvatarClickTracking();

    // State
    this._wasHidden = false;
    this._autoTalkInProgress = false;
  }

  _setupVisibilityTracking() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this._wasHidden) {
        this._wasHidden = false;
        this.mood.onInteraction('return');
        this._triggerAutoTalk('user_returned');
      } else if (document.visibilityState === 'hidden') {
        this._wasHidden = true;
      }
    });
  }

  _setupAvatarClickTracking() {
    const canvas = document.getElementById('avatar-canvas');
    if (canvas) {
      canvas.addEventListener('click', () => {
        this.mood.onInteraction('click');
        if (!this._autoTalkInProgress && !this.orchestrator.isBusy) {
          this._triggerAutoTalk('avatar_clicked');
        }
      });
    }
  }

  /**
   * Call this when the user sends a message (resets idle timer)
   */
  onUserActivity() {
    this.timeSinceUserActivity = 0;
    this.mood.onInteraction('message');
  }

  /**
   * Start the autonomous behavior loop
   */
  start() {
    this.running = true;
    console.log('[AutonomousBehavior] Started');
  }

  /**
   * Stop autonomous behavior
   */
  stop() {
    this.running = false;
    console.log('[AutonomousBehavior] Stopped');
  }

  /**
   * Update — call every frame
   * @param {number} delta — seconds since last frame
   */
  update(delta) {
    if (!this.running || !this.enabled) return;

    this.timeSinceUserActivity += delta;
    this.timeSinceLastAutoTalk += delta;
    this.checkTimer += delta;

    // Only check triggers periodically (not every frame)
    if (this.checkTimer < this.checkInterval) return;
    this.checkTimer = 0;

    // Don't auto-talk if busy or too soon since last auto-talk
    if (this._autoTalkInProgress || this.orchestrator.isBusy) return;
    if (this.timeSinceLastAutoTalk < this.config.minAutoTalkGap) return;
    if (!this.ai.connected) return;

    // Check triggers
    this._checkIdleTrigger();
    this._checkMoodTrigger();
  }

  _checkIdleTrigger() {
    if (this.timeSinceUserActivity >= this.config.idleTimeout) {
      this._triggerAutoTalk('idle_timeout');
    }
  }

  _checkMoodTrigger() {
    const mood = this.mood.getMood();
    
    // Boredom trigger
    if (mood.bored > this.config.moodThreshold) {
      this._triggerAutoTalk('mood_bored');
      return;
    }

    // Curiosity trigger
    if (mood.curious > this.config.moodThreshold) {
      this._triggerAutoTalk('mood_curious');
      return;
    }

    // Sleepy trigger
    if (mood.sleepy > this.config.moodThreshold) {
      this._triggerAutoTalk('mood_sleepy');
      return;
    }
  }

  /**
   * Trigger an autonomous talk
   * @param {string} reason — why the auto-talk was triggered
   */
  async _triggerAutoTalk(reason) {
    if (this._autoTalkInProgress) return;
    this._autoTalkInProgress = true;
    this.timeSinceLastAutoTalk = 0;

    console.log(`[AutonomousBehavior] Triggered: ${reason}`);

    const prompt = this._buildPrompt(reason);

    try {
      const response = await this.ai.sendSystemPrompt(prompt);
      const command = this.parser.parse(response);

      // Update mood based on expressed emotion
      this.mood.onEmotionExpressed(command.emotion);

      // Execute the command
      await this.orchestrator.executeCommand(command);
    } catch (err) {
      console.warn('[AutonomousBehavior] Failed:', err.message);
    }

    this._autoTalkInProgress = false;
  }

  /**
   * Build a contextual prompt based on the trigger reason
   */
  _buildPrompt(reason) {
    const moodDesc = this.mood.getMoodDescription();
    const silenceTime = Math.round(this.timeSinceUserActivity);

    const prompts = {
      idle_timeout: `${moodDesc} The user has been silent for ${silenceTime} seconds. Say something proactive — ask a question, make a comment, or try to engage them. Keep it natural and brief.`,
      
      user_returned: `${moodDesc} The user just came back after being away! Greet them warmly. React based on your mood. Keep it short and natural.`,
      
      avatar_clicked: `${moodDesc} The user just clicked on you / poked you. React to being poked! Be playful. Keep it very short (1-2 sentences).`,
      
      mood_bored: `${moodDesc} You are feeling very bored because nothing has been happening. Express your boredom in a funny or dramatic way. Try to start a conversation. Keep it brief.`,
      
      mood_curious: `${moodDesc} You are feeling very curious right now. Ask the user an interesting or random question. Be creative. Keep it brief.`,
      
      mood_sleepy: `${moodDesc} You are getting sleepy because it's been quiet. Yawn or mention being tired. Keep it very short.`,
    };

    return prompts[reason] || `${moodDesc} Say something appropriate to the situation.`;
  }
}
