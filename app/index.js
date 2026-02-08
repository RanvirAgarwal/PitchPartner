import { decode as atob, encode as btoa } from 'base-64';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import FluidUI from './FluidUI';

// --- CONFIGURATION ---
// ⚠️ IMPORTANT: Replace these with your actual API keys
const FEATHERLESS_API_KEY = 'rc_1a19fe2efea58e9740fa15291133f16d8c2c3238a179a48e566250e032251fbc';
const DEEPGRAM_API_KEY = '64c0fd8f103661e12ce9ac9695b8b1588f14570a';
const ELEVENLABS_API_KEY = 'sk_01b7bd3fb09ba0e2a2fefb609901d9609c8b6c77e366ae5f'; // <--- ADD THIS
const LLM_MODEL = "deepseek-ai/DeepSeek-R1-0528";

const { width, height } = Dimensions.get('window');

// Premium font family
const FONT = {
  light: Platform.select({ ios: 'System', android: 'sans-serif-light', web: "'Inter', 'SF Pro Display', -apple-system, sans-serif" }),
  regular: Platform.select({ ios: 'System', android: 'sans-serif', web: "'Inter', 'SF Pro Display', -apple-system, sans-serif" }),
  medium: Platform.select({ ios: 'System', android: 'sans-serif-medium', web: "'Inter', 'SF Pro Display', -apple-system, sans-serif" }),
  bold: Platform.select({ ios: 'System', android: 'sans-serif', web: "'Inter', 'SF Pro Display', -apple-system, sans-serif" }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', web: "'JetBrains Mono', 'SF Mono', monospace" }),
};

// Color palette
const C = {
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  accent: '#38BDF8',
  accentWarm: '#60A5FA',
  teal: '#2DD4BF',
  periwinkle: '#A78BFA',
  lavender: '#C4B5FD',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  cardBg: 'rgba(30, 27, 75, 0.45)',
  cardBorder: 'rgba(99, 102, 241, 0.2)',
  cardBorderActive: 'rgba(99, 102, 241, 0.6)',
  surface: 'rgba(15, 23, 42, 0.6)',
  glow: '#7DD3FC',
};

// --- VOICE IDs (ElevenLabs voices) ---
const VOICES = {
  brutal: 'pNInz6obpgDQGcFmaJgB',
  analytical: 'TxGEqnHWrfWFTfGW9XjX',
  emotional: 'EXAVITQu4vr4xnSDxMaL',
  skeptic: 'VR6AewLTigWG4xSOukaG',
  technical: 'onwK4e9ZLuTAKqWW03F9',
};

// --- AVATAR CONFIGURATION ---
const AVATAR_TALKING = { uri: 'https://media1.tenor.com/m/trBThsE-oHAAAAAd/pengu-pudgy.gif' };
const AVATAR_IDLE = { uri: "https://media1.tenor.com/m/FDQQBo83UMIAAAAd/xylophone-music.gif" };

// --- SHARK PERSONALITIES (Refined) ---
const SHARKS = {
  brutal: {
    name: "Mr. Ruthless",
    icon: "⚡",
    voice: VOICES.brutal,
    style: "Extremely harsh, focuses on numbers and ROI. Will tear apart any weakness.",
    color: "#EF4444",
    speed: 1.2,
    gradient: ['#EF4444', '#DC2626']
  },
  analytical: {
    name: "The Calculator",
    icon: "📊",
    voice: VOICES.analytical,
    style: "Data-driven, asks probing questions about metrics and unit economics.",
    color: "#3B82F6",
    speed: 1.0,
    gradient: ['#3B82F6', '#2563EB']
  },
  emotional: {
    name: "Heart & Hustle",
    icon: "💜",
    voice: VOICES.emotional,
    style: "Focuses on founder story and passion. Wants to feel the WHY.",
    color: "#A78BFA",
    speed: 0.9,
    gradient: ['#A78BFA', '#8B5CF6']
  },
  skeptic: {
    name: "The Doubter",
    icon: "⚠",
    voice: VOICES.skeptic,
    style: "Questions everything. Tests your conviction relentlessly.",
    color: "#F59E0B",
    speed: 1.1,
    gradient: ['#F59E0B', '#D97706']
  },
  technical: {
    name: "Tech Titan",
    icon: "⚡",
    voice: VOICES.technical,
    style: "Deep dives into product, tech stack, and defensibility.",
    color: "#2DD4BF",
    speed: 1.0,
    gradient: ['#2DD4BF', '#14B8A6']
  }
};

// --- PRACTICE MODES (Refined) ---
const MODES = {
  elevator: { 
    name: "Elevator Pitch", 
    duration: 60, 
    description: "60 seconds to make them remember you", 
    rounds: 3,
    badge: "QUICK"
  },
  fullPitch: { 
    name: "Full Pitch", 
    duration: 300, 
    description: "5 minutes to tell your story + Q&A", 
    rounds: 5,
    badge: "DEEP"
  },
  qanda: { 
    name: "Rapid Fire Q&A", 
    duration: 180, 
    description: "Tough questions, fast answers", 
    rounds: 8,
    badge: "INTENSE"
  },
  freestyle: { 
    name: "Freestyle", 
    duration: null, 
    description: "Practice at your own pace", 
    rounds: null,
    badge: "FLEX"
  }
};

// --- ANIMATED AVATAR COMPONENT ---
function AnimatedAvatar({ isSpeaking }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.06, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [isSpeaking]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.avatarContainer}>
      <Animated.View style={[styles.avatarGlow, { opacity: glowOpacity }]} />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Image source={isSpeaking ? AVATAR_TALKING : AVATAR_IDLE} style={styles.avatarImage} />
      </Animated.View>
      {isSpeaking && (
        <View style={styles.speakingPill}>
          <Text style={styles.speakingLabel}>SPEAKING</Text>
        </View>
      )}
    </View>
  );
}

// --- WEB-ONLY Mediapipe runner ---
function MediapipeWeb({ onMetrics, style }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let videoEl;
    let stream;
    let rafId;
    let faceMesh, pose;
    let lastFaceLandmarks = null;
    let lastPoseLandmarks = null;
    let running = true;
    let metricsInterval;

    const loadMediapipeScripts = () => {
      return new Promise((resolve, reject) => {
        if (window.FaceMesh && window.Pose) { resolve(); return; }
        let loadedCount = 0;
        const totalScripts = 2;
        const checkAllLoaded = () => { loadedCount++; if (loadedCount === totalScripts) resolve(); };

        if (!window.FaceMesh) {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
          s.crossOrigin = 'anonymous';
          s.onload = checkAllLoaded;
          s.onerror = () => reject(new Error('Failed to load FaceMesh'));
          document.head.appendChild(s);
        } else { checkAllLoaded(); }

        if (!window.Pose) {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
          s.crossOrigin = 'anonymous';
          s.onload = checkAllLoaded;
          s.onerror = () => reject(new Error('Failed to load Pose'));
          document.head.appendChild(s);
        } else { checkAllLoaded(); }
      });
    };

    const start = async () => {
      try {
        await loadMediapipeScripts();
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!window.FaceMesh || !window.Pose) throw new Error('MediaPipe libraries not loaded');

        faceMesh = new window.FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
        faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        faceMesh.onResults((r) => { if (r.multiFaceLandmarks?.[0]) lastFaceLandmarks = r.multiFaceLandmarks[0]; });

        pose = new window.Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        pose.onResults((r) => { if (r.poseLandmarks) lastPoseLandmarks = r.poseLandmarks; });

        videoEl = document.createElement('video');
        videoEl.setAttribute('playsinline', 'true');
        videoEl.autoplay = true;
        videoEl.muted = true;
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.objectFit = 'cover';
        videoEl.style.transform = 'scaleX(-1)';
        videoEl.style.borderRadius = '16px';
        containerRef.current?.appendChild(videoEl);

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        videoEl.srcObject = stream;
        await videoEl.play();

        const processFrame = async () => {
          if (!running) return;
          if (videoEl.readyState >= 2) {
            await faceMesh.send({ image: videoEl });
            await pose.send({ image: videoEl });
          }
          rafId = requestAnimationFrame(processFrame);
        };
        processFrame();
        metricsInterval = setInterval(() => updateScores(), 200);
      } catch (e) { console.error('Mediapipe init error:', e); }
    };

    const computeEyeContactScore = (faceLm) => {
      if (!faceLm || faceLm.length < 468) return 0;
      const noseTip = faceLm[1];
      const leftPupil = faceLm[468] || faceLm[133];
      const rightPupil = faceLm[473] || faceLm[362];
      if (!noseTip || !leftPupil || !rightPupil) return 0;
      const eyeMid = { x: (leftPupil.x + rightPupil.x) / 2, y: (leftPupil.y + rightPupil.y) / 2, z: ((leftPupil.z || 0) + (rightPupil.z || 0)) / 2 };
      const yawPenalty = Math.min(1, Math.abs(noseTip.x - eyeMid.x) * 15);
      const pitchPenalty = Math.min(1, Math.abs(noseTip.y - eyeMid.y) * 10);
      const rollPenalty = Math.min(1, Math.abs(leftPupil.y - rightPupil.y) * 8);
      return Math.max(0, Math.min(100, Math.round(100 * (1 - (yawPenalty * 0.5 + pitchPenalty * 0.35 + rollPenalty * 0.15)))));
    };

    const computePostureScore = (poseLm) => {
      if (!poseLm || poseLm.length < 33) return 0;
      const ls = poseLm[11], rs = poseLm[12], le = poseLm[7], re = poseLm[8], lh = poseLm[23], rh = poseLm[24];
      if (!ls || !rs || !le || !re) return 0;
      if (ls.visibility < 0.5 || rs.visibility < 0.5 || le.visibility < 0.5 || re.visibility < 0.5) return 0;
      let score = 100;
      score -= Math.min(35, Math.abs(ls.y - rs.y) * 300);
      const scx = (ls.x + rs.x) / 2, ecx = (le.x + re.x) / 2;
      score -= Math.min(30, Math.abs(ecx - scx) * 200);
      const scy = (ls.y + rs.y) / 2, ecy = (le.y + re.y) / 2;
      const vg = scy - ecy;
      if (vg < 0.1) score -= 30; else if (vg < 0.15) score -= 15;
      if (lh && rh && lh.visibility > 0.5 && rh.visibility > 0.5) {
        score -= Math.min(15, Math.abs(scx - (lh.x + rh.x) / 2) * 100);
      }
      return Math.max(0, Math.min(100, Math.round(score)));
    };

    const updateScores = () => {
      if (!running) return;
      const eye = lastFaceLandmarks ? computeEyeContactScore(lastFaceLandmarks) : 0;
      const post = lastPoseLandmarks ? computePostureScore(lastPoseLandmarks) : 0;
      if (eye > 0 || post > 0) onMetrics?.({ eyeContact: eye, posture: post, ts: Date.now() });
    };

    start();
    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (metricsInterval) clearInterval(metricsInterval);
      try { stream?.getTracks()?.forEach(t => t.stop()); } catch {}
      try { if (videoEl && containerRef.current) containerRef.current.removeChild(videoEl); } catch {}
    };
  }, [onMetrics]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
        <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', padding: 20 }}>
          Vision analysis available on web. Open in a browser for Mediapipe.
        </Text>
      </View>
    );
  }

  return <View ref={containerRef} style={style} />;
}

// --- APP ---
export default function App() {
  const soundRef = useRef(null);
  const recordingRef = useRef(null);
  const scrollViewRef = useRef(null);
  const timerRef = useRef(null);
  const currentAudioRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("READY");
  const [messages, setMessages] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [screen, setScreen] = useState('home');
  const [selectedShark, setSelectedShark] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);

  const [sessionMetrics, setSessionMetrics] = useState({
    fillerWords: 0, totalWords: 0, clarityScore: 0, confidenceScore: 0,
    eyeContactScore: 0, postureScore: 0, rounds: 0
  });
  const [currentEyeContact, setCurrentEyeContact] = useState(0);
  const [currentPosture, setCurrentPosture] = useState(0);
  const [visualSamples, setVisualSamples] = useState([]);
  const [visualFeedback, setVisualFeedback] = useState('');
  const [eyeContactVariance, setEyeContactVariance] = useState(0);

  const [timeRemaining, setTimeRemaining] = useState(null);
  const [roundNumber, setRoundNumber] = useState(1);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      const handlePopState = (e) => { e.preventDefault(); window.history.pushState(null, '', window.location.pathname); };
      const preventNavigation = (e) => {
        const target = e.target?.closest('a');
        if (target) { const href = target.getAttribute('href'); if (href && (href.includes('pitch') || href.includes('shark') || href.includes('arena'))) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return false; } }
      };
      window.addEventListener('popstate', handlePopState);
      document.addEventListener('click', preventNavigation, true);
      return () => { window.removeEventListener('popstate', handlePopState); document.removeEventListener('click', preventNavigation, true); };
    }
  }, []);

  useEffect(() => { initApp(); return () => cleanup(); }, []);

  const initApp = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await Audio.requestPermissionsAsync();
        if (status === 'granted') {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, playThroughEarpieceAndroid: false });
        }
      }
    } catch (e) { console.error("Init error:", e); }
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordingRef.current && Platform.OS !== 'web') recordingRef.current.stopAndUnloadAsync?.().catch(() => {});
    if (soundRef.current && Platform.OS !== 'web') soundRef.current.unloadAsync?.().catch(() => {});
    if (currentAudioRef.current) { try { currentAudioRef.current.pause(); currentAudioRef.current = null; } catch {} }
    setIsSpeaking(false);
  };

  const onMediapipeMetrics = useCallback(({ eyeContact, posture, ts }) => {
    const eyeScore = Math.round(eyeContact || 0);
    const postureScore = Math.round(posture || 0);
    setCurrentEyeContact(eyeScore);
    setCurrentPosture(postureScore);
    setVisualSamples(prev => {
      const updated = [...prev, { eyeContact: eyeScore, posture: postureScore, timestamp: ts || Date.now() }];
      if (updated.length >= 10) {
        const recent = updated.slice(-10).map(s => s.eyeContact);
        const mean = recent.reduce((a, b) => a + b) / recent.length;
        setEyeContactVariance(Math.round(recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length));
      }
      setSessionMetrics(prevM => {
        if (updated.length === 0) return prevM;
        let eyeSum = 0, postSum = 0, wSum = 0;
        updated.forEach((s, idx) => { const w = idx + 1; eyeSum += s.eyeContact * w; postSum += s.posture * w; wSum += w; });
        return { ...prevM, eyeContactScore: wSum > 0 ? Math.round(eyeSum / wSum) : 0, postureScore: wSum > 0 ? Math.round(postSum / wSum) : 0 };
      });
      return updated;
    });
  }, []);

  const generateAIAnalysis = async () => {
    const avgEye = visualSamples.length > 0 ? Math.round(visualSamples.reduce((s, v) => s + v.eyeContact, 0) / visualSamples.length) : 0;
    const avgPosture = visualSamples.length > 0 ? Math.round(visualSamples.reduce((s, v) => s + v.posture, 0) / visualSamples.length) : 0;
    const eyeScores = visualSamples.map(s => s.eyeContact);
    const eyeVariance = eyeScores.length > 1 ? Math.round(eyeScores.reduce((sum, val, i, arr) => { const mean = arr.reduce((a, b) => a + b) / arr.length; return sum + Math.pow(val - mean, 2); }, 0) / eyeScores.length) : 0;
    const userMessages = messages.filter(m => m.role === 'user');
    const avgWordsPerResponse = userMessages.length > 0 ? Math.round(userMessages.reduce((s, m) => s + m.content.split(/\s+/).length, 0) / userMessages.length) : 0;
    const conversationContext = userMessages.map(m => m.content).join(' | ');
    const sharkName = selectedShark ? SHARKS[selectedShark].name : 'the investor';
    const modeName = selectedMode ? MODES[selectedMode].name : 'practice';

    try {
      const response = await fetch("https://api.featherless.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FEATHERLESS_API_KEY}` },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an elite pitch coach who has trained founders that raised $500M+ collectively. You give sharp, memorable, actionable feedback that founders actually remember and use.
Your analysis style:
- Open with a vivid, honest one-line verdict (like "You pitched like someone reading a grocery list" or "That was a founder who knows their numbers cold")
- Use concrete examples from what they actually said
- Compare to what great pitches sound like
- Give exactly 3 specific drills or exercises they can do TODAY
- End with one sentence of genuine encouragement or a challenge
Write 4-5 paragraphs. Be direct, witty, and constructive. Never be generic. Never use bullet points or headers. Write like you're talking to them over coffee after the session.
The founder practiced in "${modeName}" mode against "${sharkName}".`
            },
            {
              role: 'user',
              content: `Session data:
- Eye Contact: ${avgEye}% (variance: ${eyeVariance} — ${eyeVariance > 200 ? 'very inconsistent' : eyeVariance > 100 ? 'somewhat inconsistent' : 'fairly steady'})
- Posture: ${avgPosture}%
- Clarity: ${sessionMetrics.clarityScore}%
- Confidence: ${sessionMetrics.confidenceScore}%
- Words: ${sessionMetrics.totalWords}, Fillers: ${sessionMetrics.fillerWords} (${sessionMetrics.totalWords > 0 ? Math.round(sessionMetrics.fillerWords / sessionMetrics.totalWords * 100) : 0}% filler rate)
- Avg response: ${avgWordsPerResponse} words
- Rounds: ${sessionMetrics.rounds}

What they said:
${conversationContext || '[No speech captured]'}

Give your analysis.`
            }
          ],
          max_tokens: 900,
          temperature: 0.8
        })
      });
      const data = await response.json();
      let analysis = data.choices?.[0]?.message?.content || '';
      if (analysis.includes('</think>')) analysis = analysis.split('</think>')[1]?.trim() || analysis;
      analysis = analysis.replace(/<think>[\s\S]*$/g, '').trim();
      return analysis || generateFallbackAnalysis(avgEye, avgPosture, avgWordsPerResponse, eyeVariance);
    } catch (e) {
      console.error('AI Analysis error:', e);
      return generateFallbackAnalysis(avgEye, avgPosture, avgWordsPerResponse, eyeVariance);
    }
  };

  const generateFallbackAnalysis = (avgEye, avgPosture, avgWords, eyeVar) => {
    const fillerRate = sessionMetrics.totalWords > 0 ? Math.round(sessionMetrics.fillerWords / sessionMetrics.totalWords * 100) : 0;
    const verdict = sessionMetrics.confidenceScore >= 70 ? "You showed real conviction in there — now let's sharpen the edges." : sessionMetrics.confidenceScore >= 40 ? "Decent foundation, but you're leaving persuasion points on the table." : "Honest truth: that pitch needs serious work before it's investor-ready.";

    return `${verdict}

Your speech clocked in at ${sessionMetrics.totalWords} words across ${sessionMetrics.rounds} rounds with a ${fillerRate}% filler rate. ${fillerRate > 8 ? "That filler rate is a red flag — every 'um' and 'like' chips away at your credibility. Investors notice this immediately." : fillerRate > 3 ? "Your filler rate is manageable but still noticeable. The best founders speak with clean, deliberate sentences." : "Clean speech — that's a real advantage. You sound like someone who's practiced."} Your clarity score of ${sessionMetrics.clarityScore}% ${sessionMetrics.clarityScore >= 75 ? "shows you can articulate your ideas well" : "suggests your message isn't landing as crisply as it needs to"}.

${avgEye >= 70 ? "Your eye contact was solid at " + avgEye + "%, which builds trust." : "Eye contact at " + avgEye + "% is below where it needs to be — investors read averted eyes as uncertainty or dishonesty."} ${eyeVar > 200 ? "More concerning is how inconsistent it was — you'd lock in then drift away, which reads as distracted." : ""} Posture held at ${avgPosture}%, ${avgPosture >= 75 ? "projecting the physical confidence that backs up your words." : "which undermines your message. Slouching or shifting tells investors you're not sure about what you're saying."}

Here are three things to do before your next session. First, record yourself giving your 30-second hook and count every filler word — then do it again until you hit zero. Second, practice the "3-second hold" — pick a spot on camera and hold eye contact for a full three seconds before naturally shifting. Third, ${avgWords < 30 ? "expand your answers. You're being too brief — investors want depth, not telegrams. Practice the STAR method: Situation, Task, Action, Result." : avgWords > 90 ? "cut your answers in half. You're over-explaining. For every answer, find the one sentence that matters most and lead with it." : "work on your opening line for each answer — make the first five words count, because that's when investors decide whether to keep listening."}

${sessionMetrics.confidenceScore >= 60 ? "You've got the raw material. Now it's about repetition until this pitch feels like breathing." : "Don't be discouraged — every great founder bombed their first pitches. The ones who made it just kept showing up. Come back tomorrow and beat today's scores."}`;
  };

  const analyzeTranscript = (transcript) => {
    const words = transcript.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const totalWords = words.length;
    if (totalWords === 0) return { totalWords: 0, fillerCount: 0, weakCount: 0, powerCount: 0, clarityScore: 0, confidenceScore: 0 };
    const fillers = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'so', 'right'];
    let fillerCount = 0;
    fillers.forEach(f => { const m = transcript.match(new RegExp(`\\b${f}\\b`, 'gi')); if (m) fillerCount += m.length; });
    const weakPhrases = ['i think', 'maybe', 'sort of', 'kind of', 'probably', 'i guess', 'not sure'];
    let weakCount = 0;
    weakPhrases.forEach(p => { if (transcript.toLowerCase().includes(p)) weakCount++; });
    const powerWords = ['proven', 'results', 'revenue', 'growth', 'customers', 'traction', 'profitable', 'scale', 'market', 'opportunity', 'competitive', 'advantage', 'data', 'metrics'];
    let powerCount = 0;
    powerWords.forEach(w => { if (transcript.toLowerCase().includes(w)) powerCount++; });
    const fillerRatio = fillerCount / totalWords;
    const clarityScore = Math.max(0, Math.min(100, 100 - (fillerRatio * 400) - (weakCount * 5)));
    const confidenceScore = Math.max(0, Math.min(100, 45 + (powerCount * 8) - (weakCount * 12) - (fillerCount * 3)));
    return { totalWords, fillerCount, weakCount, powerCount, clarityScore: Math.round(clarityScore), confidenceScore: Math.round(confidenceScore) };
  };

  const stopAudio = async () => {
    try {
      setIsSpeaking(false);
      if (Platform.OS === 'web') {
        if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0; currentAudioRef.current = null; }
        return;
      }
      if (soundRef.current) {
        const s = await soundRef.current.getStatusAsync();
        if (s.isLoaded && s.isPlaying) await soundRef.current.stopAsync();
      }
    } catch (e) { console.error("Stop audio error:", e); }
  };

  const speak = async (text, voiceId, speed = 1.0) => {
    try {
      setIsSpeaking(true);
      if (Platform.OS === 'web') {
        const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY },
          body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true } })
        });
        if (!resp.ok) { setIsSpeaking(false); return; }
        const ab = await resp.arrayBuffer();
        const blob = new Blob([ab], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new window.Audio(url);
        audio.playbackRate = speed;
        currentAudioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        audio.play().catch(() => setIsSpeaking(false));
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY },
        body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true } })
      });
      if (!response.ok) { setIsSpeaking(false); return; }
      const ab = await response.arrayBuffer();
      const u8 = new Uint8Array(ab);
      let bin = ''; for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      const b64 = btoa(bin);
      if (!soundRef.current) soundRef.current = new Audio.Sound();
      await soundRef.current.unloadAsync().catch(() => {});
      await soundRef.current.loadAsync({ uri: `data:audio/mpeg;base64,${b64}` });
      await soundRef.current.setRateAsync(speed, true);
      soundRef.current.setOnPlaybackStatusUpdate((s) => { if (s.didJustFinish) setIsSpeaking(false); });
      await soundRef.current.playAsync();
    } catch (e) { console.error("TTS Error:", e); setIsSpeaking(false); }
  };

  const startRecording = useCallback(async () => {
    if (isRecording || loading) return;
    await stopAudio();
    try {
      setStatus("LISTENING…");
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = 'audio/webm;codecs=opus';
        const recorder = new MediaRecorder(stream, { mimeType: mime });
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
        recorder.start();
        recordingRef.current = { recorder, stream, chunks, mime };
        setIsRecording(true);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, playThroughEarpieceAndroid: false });
      if (recordingRef.current) try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) { console.error("Recording error:", err); setStatus("MIC ERROR"); setIsRecording(false); }
  }, [isRecording, loading]);

  const stopAndProcess = useCallback(async () => {
    if (!isRecording || !recordingRef.current) return;
    setIsRecording(false);
    setLoading(true);
    setStatus("ANALYZING…");
    try {
      let audioBody, contentType = 'audio/m4a';
      if (Platform.OS === 'web') {
        const { recorder, stream, chunks, mime } = recordingRef.current;
        await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
        stream.getTracks().forEach(t => t.stop());
        audioBody = new Blob(chunks, { type: mime });
        contentType = mime;
        recordingRef.current = null;
      } else {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        audioBody = bytes;
        recordingRef.current = null;
      }
      const dgResp = await fetch(`https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true`, {
        method: "POST",
        headers: { "Authorization": `Token ${DEEPGRAM_API_KEY}`, "Content-Type": contentType },
        body: audioBody
      });
      if (!dgResp.ok) { setStatus(`STT error ${dgResp.status}`); setLoading(false); return; }
      const dgJson = await dgResp.json();
      const transcript = dgJson.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      if (transcript?.trim().length > 0) {
        const analysis = analyzeTranscript(transcript);
        setSessionMetrics(prev => ({
          totalWords: prev.totalWords + analysis.totalWords,
          fillerWords: prev.fillerWords + analysis.fillerCount,
          clarityScore: prev.rounds === 0 ? analysis.clarityScore : Math.round((prev.clarityScore * 0.6 + analysis.clarityScore * 0.4)),
          confidenceScore: prev.rounds === 0 ? analysis.confidenceScore : Math.round((prev.confidenceScore * 0.6 + analysis.confidenceScore * 0.4)),
          eyeContactScore: prev.eyeContactScore,
          postureScore: prev.postureScore,
          rounds: prev.rounds + 1
        }));
        await handleBrain(transcript, analysis);
      } else { setStatus("DIDN'T CATCH THAT"); setLoading(false); }
    } catch (e) { console.error("Processing error:", e); setStatus("ERROR"); setLoading(false); }
  }, [isRecording, selectedShark, selectedMode, messages]);

  const handleBrain = async (userText, speechAnalysis) => {
    const shark = SHARKS[selectedShark];
    const mode = MODES[selectedMode];
    const updatedMessages = [...messages, { role: 'user', content: userText }];
    setMessages(updatedMessages);

    const systemPrompt = `You are ${shark.name}, a tough investor on Shark Tank. ${shark.style}

You are IN THE TANK right now. This is round ${roundNumber} of a ${mode.name} session.

CRITICAL RULES:
1. NEVER use <think> tags or show your reasoning
2. Respond ONLY with what you would say out loud to the founder
3. React specifically to what they JUST said — quote or reference their words
4. ${selectedShark === 'brutal' ? "Be blunt and impatient. Use short, punchy sentences. Only care about money." : selectedShark === 'analytical' ? "Speak precisely and reference specific numbers. Ask for data points." : selectedShark === 'emotional' ? "Connect on a human level first, but don't be a pushover. Feel their passion." : selectedShark === 'skeptic' ? "Play devil's advocate. Poke holes. Challenge every assumption." : "Geek out on product details, tech moats, and scalability."}
5. If they were vague, call it out directly
6. If they said something compelling, acknowledge it briefly then push harder
7. Ask ONE sharp follow-up question that goes deeper
8. Keep it to 2-3 sentences max
9. Sound like a real person talking, not a template
10. NEVER mention presentation skills, body language, eye contact, or how they're speaking
11. ONLY discuss their business, product, numbers, market, or strategy
12. Start speaking immediately - no preamble, no thinking out loud

Your response should be EXACTLY what you'd say in the tank. Nothing else.`;

    try {
      setStatus("THINKING...");
      
      // Validate API key
      if (!FEATHERLESS_API_KEY || FEATHERLESS_API_KEY === 'YOUR_FEATHERLESS_API_KEY_HERE') {
        throw new Error("Featherless API key not configured");
      }
      
      const response = await fetch("https://api.featherless.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FEATHERLESS_API_KEY}` },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...updatedMessages.slice(-6).map(m => ({ role: m.role, content: m.content }))
          ],
          max_tokens: 200,
          temperature: 0.9
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", response.status, errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      if (!data.choices?.[0]) throw new Error("No response from AI");
      
      let aiText = data.choices[0].message?.content || '';
      
      // Remove thinking tags comprehensively - multiple passes
      for (let i = 0; i < 3; i++) {
        aiText = aiText.replace(/<think>[\s\S]*?<\/think>/gi, '');
        aiText = aiText.replace(/<think>[\s\S]*$/gi, '');
        aiText = aiText.replace(/^[\s\S]*?<\/think>/gi, '');
      }
      
      // Remove code blocks and markdown
      aiText = aiText.replace(/```[\s\S]*?```/g, '');
      aiText = aiText.replace(/\*\*/g, '');
      aiText = aiText.replace(/\*/g, '');
      aiText = aiText.replace(/#{1,6}\s/g, '');
      
      // Remove any XML-like tags
      aiText = aiText.replace(/<[^>]+>/g, '');
      
      // Clean up whitespace and newlines
      aiText = aiText.replace(/\n{3,}/g, '\n\n');
      aiText = aiText.trim();
      
      // Remove common AI preambles
      aiText = aiText.replace(/^(Here's what I would say:|Let me respond:|My response:)/i, '');
      aiText = aiText.trim();
      
      // Validate it's actually dialogue
      const hasQuestionMark = aiText.includes('?');
      const hasWords = aiText.split(/\s+/).length >= 3;
      
      // Fallback if nothing valid left
      if (!aiText || aiText.length < 5 || !hasWords) {
        const fallbacks = [
          "What's your customer acquisition cost?",
          "Talk to me about your margins.",
          "Who are your competitors and why are you better?",
          "What's your monthly revenue right now?",
          "How much are you asking for and what's the valuation?"
        ];
        aiText = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
      setStatus("YOUR TURN");
      speak(aiText, shark.voice, shark.speed);
      setRoundNumber(prev => prev + 1);
      setLoading(false);
    } catch (e) {
      console.error("AI Error:", e);
      setStatus("AI ERROR");
      
      let errorMessage = "Tell me more about your business model.";
      
      // Provide helpful error messages
      if (e.message.includes("401")) {
        console.error("❌ Invalid API key. Please check your Featherless API key.");
        errorMessage = "API configuration error. Check console for details.";
      } else if (e.message.includes("API key not configured")) {
        console.error("❌ Please add your Featherless API key to the configuration.");
        errorMessage = "Please configure your API keys first.";
      }
      
      const fallback = errorMessage;
      setMessages(prev => [...prev, { role: 'assistant', content: fallback }]);
      speak(fallback, shark.voice, shark.speed);
      setLoading(false);
    }
  };

  const startSession = (e) => {
    if (e?.preventDefault) { e.preventDefault(); e.stopPropagation(); }
    if (!selectedShark || !selectedMode) return;
    const openingLines = {
      brutal: "You've got 60 seconds. Don't waste my time.",
      analytical: "Walk me through your unit economics.",
      emotional: "Before the numbers — tell me why you started this.",
      skeptic: "I've seen a hundred pitches like this. Why is yours different?",
      technical: "What's your technical moat? And don't say 'AI'."
    };
    const opening = openingLines[selectedShark] || "Pitch me.";
    setMessages([{ role: 'assistant', content: opening }]);
    setSessionMetrics({ fillerWords: 0, totalWords: 0, clarityScore: 0, confidenceScore: 0, eyeContactScore: 0, postureScore: 0, rounds: 0 });
    setCurrentEyeContact(0); setCurrentPosture(0); setVisualSamples([]); setVisualFeedback(''); setEyeContactVariance(0); setRoundNumber(1);
    setScreen('pitch');
    const mode = MODES[selectedMode];
    if (mode.duration) {
      setTimeRemaining(mode.duration);
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => { if (prev <= 1) { clearInterval(timerRef.current); endSession(); return 0; } return prev - 1; });
      }, 1000);
    }
    setTimeout(() => speak(opening, SHARKS[selectedShark].voice, SHARKS[selectedShark].speed), 300);
  };

  const endSession = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopAudio();
    setStatus("GENERATING ANALYSIS…");
    const insights = await generateAIAnalysis();
    setVisualFeedback(insights);
    setScreen('analysis');
  };

  const resetToHome = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopAudio();
    setScreen('home'); setSelectedShark(null); setSelectedMode(null); setMessages([]); setTimeRemaining(null); setRoundNumber(1); setVisualSamples([]); setVisualFeedback(''); setEyeContactVariance(0);
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#34D399';
    if (score >= 60) return C.accent;
    if (score >= 40) return '#FBBF24';
    return '#F87171';
  };

  const getScoreGrade = (score) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C+';
    if (score >= 40) return 'C';
    return 'D';
  };

  // ==================== SCREENS ====================
  const renderHome = () => (
    <FluidUI screen="home">
      <View style={styles.screenContainer}>
        <View style={styles.homeCentered}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIconContainer}>
              <Text style={styles.logoIconText}>PITCH</Text>
            </View>
            <Text style={styles.heroTitle}>
              PITCH <Text style={styles.heroTitleAccent}>ARENA</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Train with AI investors. Sharpen your pitch.{'\n'}Get brutally honest feedback.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScreen('setup')} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Start Practice Session</Text>
            <View style={styles.primaryBtnArrow}>
              <Text style={styles.primaryBtnArrowText}>→</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.featureRow}>
            <View style={styles.featureChip}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Voice Analysis</Text>
            </View>
            <View style={styles.featureChip}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Eye Tracking</Text>
            </View>
            <View style={styles.featureChip}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>AI Coaching</Text>
            </View>
          </View>

          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>BEFORE YOU BEGIN</Text>
            <Text style={styles.tipText}>
              Eliminate filler words — every "um" costs you credibility. Maintain eye contact with the camera. Know your numbers cold. Keep your posture confident and open.
            </Text>
          </View>
        </View>
      </View>
    </FluidUI>
  );

  const renderSetup = () => (
    <FluidUI screen="setup">
      <ScrollView style={styles.screenContainer} contentContainerStyle={styles.setupContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('home')}>
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>

        <View style={styles.setupHeader}>
          <Text style={styles.setupTitle}>
            CONFIGURE <Text style={styles.setupTitleAccent}>SESSION</Text>
          </Text>
          <Text style={styles.setupSubtitle}>Choose your investor and practice mode</Text>
        </View>

        {/* Investor Selection */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>SELECT INVESTOR</Text>
          <View style={styles.sharkGrid}>
            {Object.entries(SHARKS).map(([key, shark]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.sharkCard,
                  selectedShark === key && { 
                    borderColor: shark.color, 
                    borderWidth: 2.5, 
                    backgroundColor: shark.color + '15',
                    shadowColor: shark.color,
                    shadowOpacity: 0.4,
                    shadowRadius: 15,
                    elevation: 8,
                  }
                ]}
                onPress={() => setSelectedShark(key)}
                activeOpacity={0.7}
              >
                <View style={[styles.sharkIconBadge, { backgroundColor: shark.color + '25', borderColor: shark.color }]}>
                  <Text style={styles.sharkIcon}>{shark.icon}</Text>
                </View>
                <Text style={[styles.sharkName, selectedShark === key && { color: shark.color }]}>{shark.name}</Text>
                <Text style={styles.sharkStyle} numberOfLines={2}>{shark.style.split('.')[0]}.</Text>
                {selectedShark === key && (
                  <View style={[styles.selectedBadge, { backgroundColor: shark.color }]}>
                    <Text style={styles.selectedBadgeText}>SELECTED</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Mode Selection */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>SELECT MODE</Text>
          <View style={styles.modeGrid}>
            {Object.entries(MODES).map(([key, mode]) => (
              <TouchableOpacity
                key={key}
                style={[styles.modeCard, selectedMode === key && styles.modeCardSelected]}
                onPress={() => setSelectedMode(key)}
                activeOpacity={0.7}
              >
                <View style={styles.modeLeft}>
                  <View style={[styles.modeBadge, selectedMode === key && styles.modeBadgeActive]}>
                    <Text style={[styles.modeBadgeText, selectedMode === key && styles.modeBadgeTextActive]}>
                      {mode.badge}
                    </Text>
                  </View>
                  <View style={styles.modeInfo}>
                    <Text style={[styles.modeName, selectedMode === key && styles.modeNameActive]}>{mode.name}</Text>
                    <Text style={styles.modeDesc}>{mode.description}</Text>
                  </View>
                </View>
                {selectedMode === key && (
                  <View style={styles.modeCheckmark}>
                    <Text style={styles.modeCheckmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Begin Button */}
        <View style={styles.beginContainer}>
          <TouchableOpacity
            style={[styles.beginButton, (!selectedShark || !selectedMode) && styles.beginButtonDisabled]}
            onPress={() => startSession()}
            disabled={!selectedShark || !selectedMode}
            activeOpacity={0.8}
          >
            <Text style={styles.beginButtonText}>
              {!selectedShark ? 'SELECT AN INVESTOR ABOVE' : !selectedMode ? 'SELECT A MODE ABOVE' : 'ENTER THE ARENA →'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </FluidUI>
  );

  const renderPitch = () => (
    <FluidUI screen="pitch">
      <View style={styles.pitchContainer}>
        {/* Top section: Camera + Avatar side by side */}
        <View style={styles.pitchTop}>
          <View style={styles.cameraWrapper}>
            <MediapipeWeb onMetrics={onMediapipeMetrics} style={styles.cameraFeed} />
            <View style={styles.cameraOverlay}>
              <View style={styles.timerPill}>
                <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              </View>
              <View style={styles.roundPill}>
                <Text style={styles.roundText}>R{roundNumber}</Text>
              </View>
            </View>
          </View>
          <AnimatedAvatar isSpeaking={isSpeaking} />
        </View>

        {/* Metrics strip */}
        <View style={styles.metricsStrip}>
          {[
            { label: 'Clarity', value: sessionMetrics.clarityScore },
            { label: 'Posture', value: currentPosture },
            { label: 'Eye Contact', value: currentEyeContact },
          ].map((m, i) => (
            <View key={i} style={styles.metricItem}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={[styles.metricValue, { color: getScoreColor(m.value) }]}>{m.value}%</Text>
            </View>
          ))}
        </View>

        {/* Chat */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 20 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {m.role === 'assistant' && <Text style={styles.bubbleSender}>{SHARKS[selectedShark]?.name}</Text>}
              <Text style={styles.bubbleText}>{m.content}</Text>
            </View>
          ))}
          {loading && <ActivityIndicator color={C.primary} style={{ marginVertical: 16 }} />}
        </ScrollView>

        {/* Footer */}
        <View style={styles.pitchFooter}>
          <TouchableOpacity style={styles.endBtn} onPress={endSession} activeOpacity={0.7}>
            <Text style={styles.endBtnText}>End</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPressIn={startRecording}
            onPressOut={stopAndProcess}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.micEmoji}>{isRecording ? '⏹' : '🎤'}</Text>
            <Text style={styles.micLabel}>{isRecording ? 'Release' : 'Hold to talk'}</Text>
          </TouchableOpacity>
          <View style={{ width: 56 }} />
        </View>
      </View>
    </FluidUI>
  );

  const renderAnalysis = () => {
    const overallScore = Math.round(
      (sessionMetrics.clarityScore * 0.25 + sessionMetrics.confidenceScore * 0.25 +
       sessionMetrics.eyeContactScore * 0.25 + sessionMetrics.postureScore * 0.25)
    );

    return (
      <FluidUI screen="analysis">
        <ScrollView style={styles.screenContainer} contentContainerStyle={styles.analysisContent} showsVerticalScrollIndicator={false}>
          {/* Overall Score */}
          <View style={styles.overallScoreContainer}>
            <Text style={styles.analysisTitle}>Session Complete</Text>
            <View style={[styles.overallScoreCircle, { borderColor: getScoreColor(overallScore) }]}>
              <Text style={[styles.overallGrade, { color: getScoreColor(overallScore) }]}>{getScoreGrade(overallScore)}</Text>
              <Text style={styles.overallScoreNum}>{overallScore}%</Text>
            </View>
            <Text style={styles.overallLabel}>Overall Performance</Text>
          </View>

          {/* Score Cards - 2x2 Grid */}
          <View style={styles.scoreRow}>
            {[
              { label: 'Clarity', value: sessionMetrics.clarityScore },
              { label: 'Confidence', value: sessionMetrics.confidenceScore },
              { label: 'Eye Contact', value: sessionMetrics.eyeContactScore },
              { label: 'Posture', value: sessionMetrics.postureScore },
            ].map((s, i) => (
              <View key={i} style={styles.scoreCard}>
                <Text style={styles.scoreCardLabel}>{s.label}</Text>
                <Text style={[styles.scoreCardValue, { color: getScoreColor(s.value) }]}>{s.value}%</Text>
                <Text style={[styles.scoreCardGrade, { color: getScoreColor(s.value) }]}>{getScoreGrade(s.value)}</Text>
              </View>
            ))}
          </View>

          {/* Stats */}
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>SESSION DETAILS</Text>
            <View style={styles.statsGrid}>
              {[
                { label: 'Words Spoken', value: sessionMetrics.totalWords },
                { label: 'Filler Words', value: sessionMetrics.fillerWords },
                { label: 'Rounds', value: sessionMetrics.rounds },
                { label: 'Samples', value: visualSamples.length },
              ].map((s, i) => (
                <View key={i} style={styles.statItem}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* AI Analysis */}
          {visualFeedback ? (
            <View style={styles.analysisCard}>
              <View style={styles.analysisCardHeader}>
                <Text style={styles.analysisCardIcon}>🧠</Text>
                <Text style={styles.analysisCardTitle}>COACH'S ANALYSIS</Text>
              </View>
              <Text style={styles.analysisText}>{visualFeedback}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={resetToHome} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Back to Arena</Text>
            <View style={styles.primaryBtnArrow}>
              <Text style={styles.primaryBtnArrowText}>→</Text>
            </View>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </FluidUI>
    );
  };

  switch (screen) {
    case 'setup': return renderSetup();
    case 'pitch': return renderPitch();
    case 'analysis': return renderAnalysis();
    default: return renderHome();
  }
}

// ==================== REFINED STYLES ====================
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // === HOME (REFINED) ===
  homeCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: C.primary + '20',
    borderWidth: 2,
    borderColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  logoIconText: {
    color: C.primaryLight,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: FONT.bold,
    letterSpacing: 2,
  },
  heroTitle: {
    color: C.text,
    fontSize: 48,
    fontWeight: '900',
    fontFamily: FONT.bold,
    letterSpacing: -2,
    marginBottom: 12,
    textAlign: 'center',
  },
  heroTitleAccent: {
    color: C.primaryLight,
    textShadowColor: C.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  heroSubtitle: {
    color: C.textSecondary,
    fontSize: 16,
    fontFamily: FONT.regular,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    marginBottom: 32,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: C.primaryLight + '40',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONT.bold,
    letterSpacing: 1,
  },
  primaryBtnArrow: {
    marginLeft: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnArrowText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  featureRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
    marginRight: 8,
    shadowColor: C.accent,
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  featureText: {
    color: C.text,
    fontSize: 13,
    fontFamily: FONT.medium,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tipsCard: {
    backgroundColor: C.cardBg,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.primary + '30',
    width: '100%',
    maxWidth: 400,
    shadowColor: C.primary,
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  tipsTitle: {
    color: C.primaryLight,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONT.bold,
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  tipText: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: FONT.regular,
    lineHeight: 22,
    letterSpacing: 0.2,
  },

  // === SETUP (REFINED) ===
  setupContent: {
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 40,
    alignItems: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backBtnText: {
    color: C.primaryLight,
    fontSize: 14,
    fontFamily: FONT.bold,
    fontWeight: '700',
    letterSpacing: 1,
  },
  setupHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  setupTitle: {
    color: C.text,
    fontSize: 36,
    fontWeight: '900',
    fontFamily: FONT.bold,
    letterSpacing: -1,
    marginBottom: 8,
    textAlign: 'center',
  },
  setupTitleAccent: {
    color: C.primaryLight,
    textShadowColor: C.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  setupSubtitle: {
    color: C.textSecondary,
    fontSize: 15,
    fontFamily: FONT.regular,
    letterSpacing: 0.3,
  },
  sectionBlock: {
    width: '100%',
    maxWidth: 520,
    marginBottom: 36,
  },
  sectionLabel: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FONT.bold,
    letterSpacing: 2,
    marginBottom: 16,
    textAlign: 'center',
  },
  sharkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  sharkCard: {
    width: width > 500 ? 150 : (width - 76) / 2,
    backgroundColor: C.cardBg,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    alignItems: 'center',
    position: 'relative',
  },
  sharkIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 12,
  },
  sharkIcon: {
    fontSize: 22,
  },
  sharkName: {
    color: C.text,
    fontWeight: '800',
    fontFamily: FONT.bold,
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  sharkStyle: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: FONT.regular,
    textAlign: 'center',
    lineHeight: 16,
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  selectedBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
    fontFamily: FONT.bold,
    letterSpacing: 0.5,
  },
  modeGrid: {
    gap: 12,
  },
  modeCard: {
    flexDirection: 'row',
    backgroundColor: C.cardBg,
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    justifyContent: 'space-between',
  },
  modeCardSelected: {
    borderColor: C.primary,
    backgroundColor: C.primary + '12',
    borderWidth: 2,
    shadowColor: C.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  modeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeBadge: {
    backgroundColor: C.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 14,
    minWidth: 60,
    alignItems: 'center',
  },
  modeBadgeActive: {
    backgroundColor: C.primary,
  },
  modeBadgeText: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: FONT.bold,
    letterSpacing: 1,
  },
  modeBadgeTextActive: {
    color: '#FFF',
  },
  modeInfo: {
    flex: 1,
  },
  modeName: {
    color: C.text,
    fontWeight: '800',
    fontFamily: FONT.bold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  modeNameActive: {
    color: C.primaryLight,
  },
  modeDesc: {
    color: C.textMuted,
    fontSize: 13,
    fontFamily: FONT.regular,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  modeCheckmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeCheckmarkText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  beginContainer: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    marginTop: 8,
  },
  beginButton: {
    backgroundColor: C.primary,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: C.primaryLight + '40',
  },
  beginButtonDisabled: {
    backgroundColor: C.textMuted + '30',
    shadowOpacity: 0,
    borderColor: C.cardBorder,
  },
  beginButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontFamily: FONT.bold,
    fontSize: 14,
    letterSpacing: 1.5,
  },

  // === PITCH (REFINED - keeping functionality) ===
  pitchContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pitchTop: {
    flexDirection: 'row',
    height: 280,
    padding: 12,
    gap: 12,
  },
  cameraWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    borderWidth: 2,
    borderColor: C.primary + '30',
  },
  cameraFeed: {
    flex: 1,
    borderRadius: 16,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  timerPill: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.primary + '60',
  },
  timerText: {
    color: C.primaryLight,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FONT.mono,
    letterSpacing: 1,
  },
  roundPill: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
  },
  roundText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONT.mono,
    letterSpacing: 1,
  },
  metricsStrip: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONT.bold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: FONT.bold,
  },
  chatArea: {
    flex: 1,
  },
  bubble: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    maxWidth: '82%',
  },
  userBubble: {
    backgroundColor: C.primary + '20',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    borderWidth: 1.5,
    borderColor: C.primary + '40',
  },
  aiBubble: {
    backgroundColor: C.cardBg,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
  },
  bubbleSender: {
    color: C.primaryLight,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONT.bold,
    letterSpacing: 1,
    marginBottom: 6,
  },
  bubbleText: {
    color: C.text,
    fontSize: 15,
    fontFamily: FONT.regular,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  pitchFooter: {
    height: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  endBtn: {
    width: 64,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  endBtnText: {
    color: '#F87171',
    fontWeight: '800',
    fontFamily: FONT.bold,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  micBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  micBtnActive: {
    backgroundColor: C.primary + '30',
    borderColor: '#34D399',
    shadowColor: '#34D399',
  },
  micEmoji: {
    fontSize: 32,
  },
  micLabel: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: FONT.bold,
    marginTop: 4,
    letterSpacing: 0.5,
  },

  // === AVATAR (REFINED) ===
  avatarContainer: {
    width: 130,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.primary + '30',
    padding: 12,
    position: 'relative',
  },
  avatarGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 26,
    backgroundColor: C.primary,
    opacity: 0.3,
    ...(Platform.OS === 'web' ? { filter: 'blur(20px)' } : {}),
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  speakingPill: {
    marginTop: 10,
    backgroundColor: C.primary + '40',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  speakingLabel: {
    color: C.primaryLight,
    fontSize: 9,
    fontWeight: '900',
    fontFamily: FONT.bold,
    letterSpacing: 1.2,
  },

  // === ANALYSIS (REFINED) ===
  analysisContent: {
    paddingHorizontal: 24,
    paddingTop: 50,
    alignItems: 'center',
  },
  overallScoreContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  analysisTitle: {
    color: C.text,
    fontSize: 32,
    fontWeight: '900',
    fontFamily: FONT.bold,
    letterSpacing: -0.5,
    marginBottom: 28,
    textAlign: 'center',
  },
  overallScoreCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    marginBottom: 14,
    shadowColor: C.primary,
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  overallGrade: {
    fontSize: 38,
    fontWeight: '900',
    fontFamily: FONT.bold,
    letterSpacing: -1,
  },
  overallScoreNum: {
    color: C.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONT.medium,
    letterSpacing: 0.5,
  },
  overallLabel: {
    color: C.textMuted,
    fontSize: 13,
    fontFamily: FONT.medium,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 24,
    width: '100%',
    maxWidth: 520,
  },
  scoreCard: {
    width: (width > 500 ? 520 : width - 62) / 2 - 7,
    backgroundColor: C.cardBg,
    padding: 22,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.cardBorder,
  },
  scoreCardLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FONT.bold,
    letterSpacing: 1,
    marginBottom: 10,
  },
  scoreCardValue: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: FONT.bold,
    letterSpacing: -1,
  },
  scoreCardGrade: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONT.bold,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  statsCard: {
    backgroundColor: C.cardBg,
    padding: 26,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    width: '100%',
    maxWidth: 520,
    marginBottom: 24,
  },
  statsTitle: {
    color: C.primaryLight,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONT.bold,
    letterSpacing: 1.5,
    marginBottom: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: C.text,
    fontSize: 24,
    fontWeight: '900',
    fontFamily: FONT.bold,
    letterSpacing: -0.5,
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontFamily: FONT.medium,
    fontWeight: '600',
    marginTop: 5,
    letterSpacing: 0.3,
  },
  analysisCard: {
    backgroundColor: C.primary + '0D',
    padding: 26,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.primary + '35',
    width: '100%',
    maxWidth: 520,
    marginBottom: 32,
    shadowColor: C.primary,
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  analysisCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  analysisCardIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  analysisCardTitle: {
    color: C.primaryLight,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONT.bold,
    letterSpacing: 1.2,
  },
  analysisText: {
    color: C.text,
    fontSize: 15,
    fontFamily: FONT.regular,
    lineHeight: 25,
    letterSpacing: 0.2,
  },
});