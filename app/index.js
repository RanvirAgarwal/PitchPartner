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

// --- CONFIGURATION ---

const LLM_MODEL = "deepseek-ai/DeepSeek-R1-0528";
const { width } = Dimensions.get('window');

// --- VOICE IDs (ElevenLabs voices) ---
const VOICES = {
  brutal: 'pNInz6obpgDQGcFmaJgB', // Adam - Deep, authoritative
  analytical: 'TxGEqnHWrfWFTfGW9XjX', // Josh - Professional, precise
  emotional: 'EXAVITQu4vr4xnSDxMaL', // Bella - Warm, empathetic (female but works for emotional)
  skeptic: 'VR6AewLTigWG4xSOukaG', // Arnold - Skeptical, questioning
  technical: 'onwK4e9ZLuTAKqWW03F9', // Daniel - Technical, intelligent
};

// --- AVATAR CONFIGURATION ---
const AVATAR_TALKING = { uri: 'https://media1.tenor.com/m/trBThsE-oHAAAAAd/pengu-pudgy.gif' };
const AVATAR_IDLE = { uri: "https://media1.tenor.com/m/FDQQBo83UMIAAAAd/xylophone-music.gif" };

// --- SHARK PERSONALITIES ---
const SHARKS = {
  brutal: { 
    name: "Mr. Ruthless", 
    emoji: "🦈", 
    voice: VOICES.brutal, 
    style: "Extremely harsh, focuses on numbers and ROI. Will tear apart any weakness.", 
    color: "#FF4444",
    speed: 1.2 // Faster, aggressive
  },
  analytical: { 
    name: "The Calculator", 
    emoji: "🧮", 
    voice: VOICES.analytical, 
    style: "Data-driven, asks probing questions about metrics and unit economics.", 
    color: "#4444FF",
    speed: 1.0 // Normal, measured
  },
  emotional: { 
    name: "Heart & Hustle", 
    emoji: "❤️", 
    voice: VOICES.emotional, 
    style: "Focuses on founder story and passion. Wants to feel the WHY.", 
    color: "#FF44FF",
    speed: 0.9 // Slower, empathetic
  },
  skeptic: { 
    name: "The Doubter", 
    emoji: "🤨", 
    voice: VOICES.skeptic, 
    style: "Questions everything. Tests your conviction relentlessly.", 
    color: "#FFAA00",
    speed: 1.1 // Slightly faster, challenging
  },
  technical: { 
    name: "Tech Titan", 
    emoji: "💻", 
    voice: VOICES.technical, 
    style: "Deep dives into product, tech stack, and defensibility.", 
    color: "#00FFAA",
    speed: 1.0 // Normal, analytical
  }
};

// --- PRACTICE MODES ---
const MODES = {
  elevator: { name: "Elevator Pitch", duration: 60, description: "60 seconds to make them remember you", rounds: 3, icon: "🛗" },
  fullPitch: { name: "Full Pitch", duration: 300, description: "5 minutes to tell your story + Q&A", rounds: 5, icon: "🎯" },
  qanda: { name: "Rapid Fire Q&A", duration: 180, description: "Tough questions, fast answers", rounds: 8, icon: "⚡" },
  freestyle: { name: "Freestyle", duration: null, description: "Practice at your own pace", rounds: null, icon: "🎤" }
};

// --- ANIMATED AVATAR COMPONENT ---
function AnimatedAvatar({ isSpeaking }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.08,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isSpeaking]);

  return (
    <View style={styles.avatarContainer}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Image
          source={isSpeaking ? AVATAR_TALKING : AVATAR_IDLE}
          style={styles.avatarImage}
          resizeMode="contain"
        />
      </Animated.View>
      {isSpeaking && <Text style={styles.speakingLabel}>SPEAKING...</Text>}
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
        if (window.FaceMesh && window.Pose) {
          resolve();
          return;
        }

        let loadedCount = 0;
        const totalScripts = 2;

        const checkAllLoaded = () => {
          loadedCount++;
          if (loadedCount === totalScripts) {
            resolve();
          }
        };

        if (!window.FaceMesh) {
          const faceMeshScript = document.createElement('script');
          faceMeshScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
          faceMeshScript.crossOrigin = 'anonymous';
          faceMeshScript.onload = checkAllLoaded;
          faceMeshScript.onerror = () => reject(new Error('Failed to load FaceMesh'));
          document.head.appendChild(faceMeshScript);
        } else {
          checkAllLoaded();
        }

        if (!window.Pose) {
          const poseScript = document.createElement('script');
          poseScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
          poseScript.crossOrigin = 'anonymous';
          poseScript.onload = checkAllLoaded;
          poseScript.onerror = () => reject(new Error('Failed to load Pose'));
          document.head.appendChild(poseScript);
        } else {
          checkAllLoaded();
        }
      });
    };
    
    const start = async () => {
      try {
        await loadMediapipeScripts();
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!window.FaceMesh || !window.Pose) {
          throw new Error('MediaPipe libraries not loaded');
        }

        faceMesh = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        faceMesh.onResults((results) => {
          if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
            lastFaceLandmarks = results.multiFaceLandmarks[0];
          }
        });

        pose = new window.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        pose.onResults((results) => {
          if (results.poseLandmarks) {
            lastPoseLandmarks = results.poseLandmarks;
          }
        });

        videoEl = document.createElement('video');
        videoEl.setAttribute('playsinline', 'true');
        videoEl.autoplay = true;
        videoEl.muted = true;
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.objectFit = 'cover';
        videoEl.style.transform = 'scaleX(-1)';
        containerRef.current?.appendChild(videoEl);

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
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

        metricsInterval = setInterval(() => {
          updateScores();
        }, 200);

      } catch (e) {
        console.error('Mediapipe init error:', e);
      }
    };

    const computeEyeContactScore = (faceLm) => {
      if (!faceLm || faceLm.length < 468) return 0;
      
      const noseTip = faceLm[1];
      const leftPupil = faceLm[468] || faceLm[133];
      const rightPupil = faceLm[473] || faceLm[362];
      
      if (!noseTip || !leftPupil || !rightPupil) return 0;

      const eyeMidpoint = {
        x: (leftPupil.x + rightPupil.x) / 2,
        y: (leftPupil.y + rightPupil.y) / 2,
        z: ((leftPupil.z || 0) + (rightPupil.z || 0)) / 2
      };

      const yawOffset = Math.abs(noseTip.x - eyeMidpoint.x);
      const yawPenalty = Math.min(1, yawOffset * 15);

      const pitchOffset = Math.abs(noseTip.y - eyeMidpoint.y);
      const pitchPenalty = Math.min(1, pitchOffset * 10);

      const eyeDistance = Math.abs(leftPupil.y - rightPupil.y);
      const rollPenalty = Math.min(1, eyeDistance * 8);

      const score = 100 * (1 - (yawPenalty * 0.5 + pitchPenalty * 0.35 + rollPenalty * 0.15));
      return Math.max(0, Math.min(100, Math.round(score)));
    };

    const computePostureScore = (poseLm) => {
      if (!poseLm || poseLm.length < 33) return 0;
      
      const leftShoulder = poseLm[11];
      const rightShoulder = poseLm[12];
      const leftEar = poseLm[7];
      const rightEar = poseLm[8];
      const leftHip = poseLm[23];
      const rightHip = poseLm[24];
      
      if (!leftShoulder || !rightShoulder || !leftEar || !rightEar) {
        return 0;
      }

      if (leftShoulder.visibility < 0.5 || rightShoulder.visibility < 0.5 || 
          leftEar.visibility < 0.5 || rightEar.visibility < 0.5) {
        return 0;
      }

      let score = 100;

      const shoulderYDiff = Math.abs(leftShoulder.y - rightShoulder.y);
      const shoulderPenalty = Math.min(35, shoulderYDiff * 300);
      score -= shoulderPenalty;

      const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
      const earCenterX = (leftEar.x + rightEar.x) / 2;
      const forwardLean = Math.abs(earCenterX - shoulderCenterX);
      const leanPenalty = Math.min(30, forwardLean * 200);
      score -= leanPenalty;

      const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
      const earCenterY = (leftEar.y + rightEar.y) / 2;
      const verticalGap = shoulderCenterY - earCenterY;
      
      if (verticalGap < 0.1) {
        score -= 30;
      } else if (verticalGap < 0.15) {
        score -= 15;
      }

      if (leftHip && rightHip && leftHip.visibility > 0.5 && rightHip.visibility > 0.5) {
        const hipCenterX = (leftHip.x + rightHip.x) / 2;
        const spineAlignment = Math.abs(shoulderCenterX - hipCenterX);
        const spinePenalty = Math.min(15, spineAlignment * 100);
        score -= spinePenalty;
      }

      return Math.max(0, Math.min(100, Math.round(score)));
    };

    const updateScores = () => {
      if (!running) return;
      
      const eyeScore = lastFaceLandmarks ? computeEyeContactScore(lastFaceLandmarks) : 0;
      const postureScore = lastPoseLandmarks ? computePostureScore(lastPoseLandmarks) : 0;
      
      if (eyeScore > 0 || postureScore > 0) {
        onMetrics?.({ eyeContact: eyeScore, posture: postureScore, ts: Date.now() });
      }
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
      <View style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#ccc', textAlign: 'center', padding: 12 }}>
          Vision analysis runs on web in this build. Open in a browser to use Mediapipe.
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
    fillerWords: 0,
    totalWords: 0,
    clarityScore: 0,
    confidenceScore: 0,
    eyeContactScore: 0,
    postureScore: 0,
    rounds: 0
  });
  const [currentEyeContact, setCurrentEyeContact] = useState(0);
  const [currentPosture, setCurrentPosture] = useState(0);
  const [visualSamples, setVisualSamples] = useState([]);
  const [visualFeedback, setVisualFeedback] = useState('');
  const [eyeContactVariance, setEyeContactVariance] = useState(0);

  const [timeRemaining, setTimeRemaining] = useState(null);
  const [roundNumber, setRoundNumber] = useState(1);

  useEffect(() => {
    initApp();
    return () => cleanup();
  }, []);

  const initApp = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await Audio.requestPermissionsAsync();
        if (status === 'granted') {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            playThroughEarpieceAndroid: false,
          });
        }
      }
    } catch (e) {
      console.error("Init error:", e);
    }
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordingRef.current && Platform.OS !== 'web') {
      recordingRef.current.stopAndUnloadAsync?.().catch(() => {});
    }
    if (soundRef.current && Platform.OS !== 'web') {
      soundRef.current.unloadAsync?.().catch(() => {});
    }
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      } catch {}
    }
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
        const recentEyes = updated.slice(-10).map(s => s.eyeContact);
        const mean = recentEyes.reduce((a, b) => a + b) / recentEyes.length;
        const variance = recentEyes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentEyes.length;
        setEyeContactVariance(Math.round(variance));
      }
      
      setSessionMetrics(prevMetrics => {
        if (updated.length === 0) return prevMetrics;
        
        let eyeSum = 0, postureSum = 0, weightSum = 0;
        updated.forEach((s, idx) => {
          const w = idx + 1;
          eyeSum += s.eyeContact * w;
          postureSum += s.posture * w;
          weightSum += w;
        });
        
        return {
          ...prevMetrics,
          eyeContactScore: weightSum > 0 ? Math.round(eyeSum / weightSum) : 0,
          postureScore: weightSum > 0 ? Math.round(postureSum / weightSum) : 0,
        };
      });
      
      return updated;
    });
  }, []);

  const generateVisualInsights = async () => {
    if (visualSamples.length === 0) return "No visual data collected.";
    
    const avgEye = Math.round(visualSamples.reduce((sum, s) => sum + s.eyeContact, 0) / visualSamples.length);
    const avgPosture = Math.round(visualSamples.reduce((sum, s) => sum + s.posture, 0) / visualSamples.length);
    
    const eyeScores = visualSamples.map(s => s.eyeContact);
    const eyeMean = eyeScores.reduce((a, b) => a + b) / eyeScores.length;
    const eyeVariance = eyeScores.reduce((sum, val) => sum + Math.pow(val - eyeMean, 2), 0) / eyeScores.length;
    const eyeStdDev = Math.sqrt(eyeVariance);
    
    let driftCount = 0;
    for (let i = 1; i < eyeScores.length; i++) {
      if (Math.abs(eyeScores[i] - eyeScores[i-1]) > 20) driftCount++;
    }
    const driftPercentage = Math.round((driftCount / eyeScores.length) * 100);
    
    try {
      const response = await fetch("https://api.featherless.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${FEATHERLESS_API_KEY}`
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            {
              role: 'system',
              content: "You are an elite pitch coach. Provide ONLY final actionable advice. NO reasoning, NO thinking process. Just 3-4 direct sentences."
            },
            {
              role: 'user',
              content: `Eye Contact: ${avgEye}%, Drift: ${driftPercentage}%, Posture: ${avgPosture}%. Give 3-4 sentences of specific advice.`
            }
          ],
          max_tokens: 150,
          temperature: 0.7
        })
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "Continue practicing your visual presence.";
    } catch (e) {
      console.error('Visual insights error:', e);
      return `Eye contact averaged ${avgEye}% with ${driftPercentage}% drift. Posture averaged ${avgPosture}%. Lock eyes with camera for 3+ seconds.`;
    }
  };

  const analyzeTranscript = (transcript) => {
    const words = transcript.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const totalWords = words.length;
    
    if (totalWords === 0) return {
      totalWords: 0,
      fillerCount: 0,
      weakCount: 0,
      powerCount: 0,
      clarityScore: 0,
      confidenceScore: 0
    };
    
    const fillers = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally'];
    let fillerCount = 0;
    fillers.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = transcript.match(regex);
      if (matches) fillerCount += matches.length;
    });
    
    const weakPhrases = ['i think', 'maybe', 'sort of', 'kind of', 'probably'];
    let weakCount = 0;
    weakPhrases.forEach(phrase => {
      if (transcript.toLowerCase().includes(phrase)) weakCount++;
    });
    
    const powerWords = ['proven', 'results', 'revenue', 'growth', 'customers', 'traction'];
    let powerCount = 0;
    powerWords.forEach(word => {
      if (transcript.toLowerCase().includes(word)) powerCount++;
    });
    
    const fillerRatio = fillerCount / totalWords;
    const clarityScore = Math.max(0, Math.min(100, 100 - (fillerRatio * 500)));
    const confidenceScore = Math.max(0, Math.min(100, 50 + (powerCount * 10) - (weakCount * 15)));
    
    return {
      totalWords,
      fillerCount,
      weakCount,
      powerCount,
      clarityScore: Math.round(clarityScore),
      confidenceScore: Math.round(confidenceScore)
    };
  };

  const stopAudio = async () => {
    try {
      setIsSpeaking(false);
      
      if (Platform.OS === 'web') {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
          currentAudioRef.current = null;
        }
        return;
      }
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.stopAsync();
        }
      }
    } catch (e) {
      console.error("Stop audio error:", e);
    }
  };

  const speak = async (text, voiceId, speed = 1.0) => {
    try {
      setIsSpeaking(true);
      
      if (Platform.OS === 'web') {
        const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5", // Faster model
            voice_settings: { 
              stability: 0.6, 
              similarity_boost: 0.8,
              style: 0.5,
              use_speaker_boost: true
            }
          })
        });
        if (!resp.ok) {
          setIsSpeaking(false);
          return;
        }
        const arrayBuffer = await resp.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new window.Audio(url);
        audio.playbackRate = speed; // Apply speed
        currentAudioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        audio.play().catch(e => {
          console.error('Audio play error', e);
          setIsSpeaking(false);
        });
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { 
            stability: 0.6, 
            similarity_boost: 0.8,
            style: 0.5,
            use_speaker_boost: true
          }
        })
      });
      if (!response.ok) {
        setIsSpeaking(false);
        return;
      }
      const arrayBuffer = await response.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64Audio = btoa(binary);
      if (!soundRef.current) {
        soundRef.current = new Audio.Sound();
      }
      await soundRef.current.unloadAsync().catch(() => {});
      await soundRef.current.loadAsync({ uri: `data:audio/mpeg;base64,${base64Audio}` });
      await soundRef.current.setRateAsync(speed, true); // Apply speed on native
      soundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsSpeaking(false);
        }
      });
      await soundRef.current.playAsync();
    } catch (e) {
      console.error("TTS Error:", e);
      setIsSpeaking(false);
    }
  };

  const startRecording = useCallback(async () => {
    if (isRecording || loading) return;
    
    await stopAudio();
    
    try {
      setStatus("LISTENING...");
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = 'audio/webm;codecs=opus';
        const recorder = new MediaRecorder(stream, { mimeType: mime });
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        recorder.start();
        recordingRef.current = { recorder, stream, chunks, mime };
        setIsRecording(true);
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch (e) {}
      }
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = newRecording;
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      setStatus("MIC ERROR: " + err.message);
      setIsRecording(false);
    }
  }, [isRecording, loading]);

  const stopAndProcess = useCallback(async () => {
    if (!isRecording || !recordingRef.current) return;
    setIsRecording(false);
    setLoading(true);
    setStatus("ANALYZING...");
    try {
      let audioBody;
      let contentType = 'audio/m4a';
      if (Platform.OS === 'web') {
        const { recorder, stream, chunks, mime } = recordingRef.current;
        await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: mime });
        audioBody = blob;
        contentType = mime;
        recordingRef.current = null;
      } else {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64
        });
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        audioBody = bytes;
        contentType = 'audio/m4a';
        recordingRef.current = null;
      }
      const dgResp = await fetch(`https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true`, {
        method: "POST",
        headers: {
          "Authorization": `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": contentType
        },
        body: audioBody
      });
      if (!dgResp.ok) {
        const err = await dgResp.text().catch(() => '');
        console.error('Deepgram error', dgResp.status, err);
        setStatus(`STT error ${dgResp.status}`);
        setLoading(false);
        return;
      }
      const dgJson = await dgResp.json();
      const transcript = dgJson.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      if (transcript && transcript.trim().length > 0) {
        const analysis = analyzeTranscript(transcript);
        setSessionMetrics(prev => ({
          totalWords: prev.totalWords + analysis.totalWords,
          fillerWords: prev.fillerWords + analysis.fillerCount,
          clarityScore: prev.rounds === 0 ? analysis.clarityScore : Math.round((prev.clarityScore + analysis.clarityScore) / 2),
          confidenceScore: prev.rounds === 0 ? analysis.confidenceScore : Math.round((prev.confidenceScore + analysis.confidenceScore) / 2),
          eyeContactScore: prev.eyeContactScore,
          postureScore: prev.postureScore,
          rounds: prev.rounds + 1
        }));
        await handleBrain(transcript, analysis);
      } else {
        setStatus("DIDN'T CATCH THAT - TRY AGAIN");
        setLoading(false);
      }
    } catch (e) {
      console.error("Processing error:", e);
      setStatus("ERROR: " + e.message);
      setLoading(false);
    }
  }, [isRecording, selectedShark, selectedMode, messages]);

  const handleBrain = async (userText, speechAnalysis) => {
    const shark = SHARKS[selectedShark];
    const mode = MODES[selectedMode];
    const updatedMessages = [...messages, { role: 'user', content: userText }];
    setMessages(updatedMessages);
    
    // Build feedback about visuals if they're poor
    let visualFeedback = '';
    if (currentEyeContact > 0 && currentEyeContact < 50) {
      visualFeedback += `Your eye contact is weak (${currentEyeContact}%). `;
    }
    if (currentPosture > 0 && currentPosture < 50) {
      visualFeedback += `Your posture needs work (${currentPosture}%). `;
    }
    
    const systemPrompt = `You are ${shark.name}, a tough Shark Tank investor. ${shark.style}

Round ${roundNumber}. Ask ONE tough question OR give ONE critique. Stay in character.
${visualFeedback ? `Also comment on this: ${visualFeedback}` : ''}

Keep your response to 2-3 sentences maximum. Be direct and conversational.`;

    try {
      setStatus("THINKING...");
      const response = await fetch("https://api.featherless.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${FEATHERLESS_API_KEY}`
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...updatedMessages.slice(-4).map(m => ({ role: m.role, content: m.content }))
          ],
          max_tokens: 200, // Allow longer responses
          temperature: 0.8
        })
      });
      const data = await response.json();
      
      if (!data.choices?.[0]) {
        throw new Error("No response from AI");
      }
      
      let aiText = data.choices[0].message?.content || '';
      
      // CRITICAL: Extract actual text from thinking blocks
      // DeepSeek returns thinking in <think> tags - we need the actual response
      if (aiText.includes('<think>')) {
        const parts = aiText.split('</think>');
        aiText = parts.length > 1 ? parts[1].trim() : aiText;
      }
      
      // Clean up any markdown artifacts
      aiText = aiText.replace(/```[\s\S]*?```/g, ''); // Remove code blocks
      aiText = aiText.replace(/\*\*/g, '').replace(/\*/g, ''); // Remove markdown bold/italic
      aiText = aiText.trim();
      
      // If we get nothing, provide fallback
      if (!aiText || aiText.length < 5) {
        aiText = "Tell me more about your business model.";
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
      setStatus("YOUR TURN");
      speak(aiText, shark.voice, shark.speed);
      setRoundNumber(prev => prev + 1);
    } catch (e) {
      console.error("AI Error:", e);
      setStatus("AI ERROR: " + e.message);
      const fallbackText = "Tell me more about your business.";
      setMessages(prev => [...prev, { role: 'assistant', content: fallbackText }]);
      speak(fallbackText, shark.voice, shark.speed);
    } finally {
      setLoading(false);
    }
  };

  const startSession = () => {
    if (!selectedShark || !selectedMode) return;
    const openingLines = {
      brutal: "60 seconds. Go.",
      analytical: "Show me your numbers.",
      emotional: "Why does this matter?",
      skeptic: "This won't work. Prove me wrong.",
      technical: "What's your moat?"
    };
    const opening = openingLines[selectedShark] || "Pitch me.";
    setMessages([{ role: 'assistant', content: opening }]);
    setSessionMetrics({
      fillerWords: 0,
      totalWords: 0,
      clarityScore: 0,
      confidenceScore: 0,
      eyeContactScore: 0,
      postureScore: 0,
      rounds: 0
    });
    setCurrentEyeContact(0);
    setCurrentPosture(0);
    setVisualSamples([]);
    setVisualFeedback('');
    setEyeContactVariance(0);
    setRoundNumber(1);
    setScreen('pitch');
    const mode = MODES[selectedMode];
    if (mode.duration) {
      setTimeRemaining(mode.duration);
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            endSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    const shark = SHARKS[selectedShark];
    setTimeout(() => speak(opening, shark.voice, shark.speed), 300);
  };

  const endSession = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopAudio();
    const insights = await generateVisualInsights();
    setVisualFeedback(insights);
    setScreen('analysis');
  };

  const resetToHome = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopAudio();
    setScreen('home');
    setSelectedShark(null);
    setSelectedMode(null);
    setMessages([]);
    setTimeRemaining(null);
    setRoundNumber(1);
    setVisualSamples([]);
    setVisualFeedback('');
    setEyeContactVariance(0);
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#00FF41';
    if (score >= 50) return '#FFAA00';
    return '#FF4444';
  };

  const renderHome = () => (
    <ScrollView style={styles.screenContainer} contentContainerStyle={styles.homeContent}>
      <View style={styles.heroSection}>
        <Text style={styles.heroEmoji}>🦈</Text>
        <Text style={styles.heroTitle}>PITCH ARENA</Text>
        <Text style={styles.heroSubtitle}>Practice pitching with AI investors</Text>
      </View>
      <TouchableOpacity style={styles.startButton} onPress={() => setScreen('setup')}>
        <Text style={styles.startButtonText}>START PRACTICE</Text>
      </TouchableOpacity>
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 QUICK TIPS</Text>
        <Text style={styles.tipItem}>• Eliminate filler words (um, uh, like)</Text>
        <Text style={styles.tipItem}>• Maintain eye contact with camera</Text>
        <Text style={styles.tipItem}>• Keep good posture - shoulders back</Text>
        <Text style={styles.tipItem}>• Know your numbers cold</Text>
      </View>
    </ScrollView>
  );

  const renderSetup = () => (
    <ScrollView style={styles.screenContainer} contentContainerStyle={styles.setupContent}>
      <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('home')}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.setupTitle}>CHOOSE YOUR CHALLENGE</Text>
      <View style={styles.setupSection}>
        <Text style={styles.sectionTitle}>🦈 SELECT SHARK</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sharkScroll}>
          {Object.entries(SHARKS).map(([key, shark]) => (
            <TouchableOpacity
              key={key}
              style={[styles.sharkCard, selectedShark === key && {borderColor: shark.color, borderWidth: 3}]}
              onPress={() => setSelectedShark(key)}
            >
              <Text style={styles.sharkEmoji}>{shark.emoji}</Text>
              <Text style={styles.sharkName}>{shark.name}</Text>
              <Text style={styles.sharkStyle} numberOfLines={3}>{shark.style}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.setupSection}>
        <Text style={styles.sectionTitle}>🎯 SELECT MODE</Text>
        {Object.entries(MODES).map(([key, mode]) => (
          <TouchableOpacity
            key={key}
            style={[styles.modeCard, selectedMode === key && styles.modeCardSelected]}
            onPress={() => setSelectedMode(key)}
          >
            <Text style={styles.modeIcon}>{mode.icon}</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeName}>{mode.name}</Text>
              <Text style={styles.modeDesc}>{mode.description}</Text>
            </View>
            {selectedMode === key && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.beginButton, (!selectedShark || !selectedMode) && styles.beginButtonDisabled]}
        onPress={startSession}
        disabled={!selectedShark || !selectedMode}
      >
        <Text style={styles.beginButtonText}>
          {!selectedShark ? 'CHOOSE A SHARK ↑' : !selectedMode ? 'CHOOSE A MODE ↑' : 'BEGIN SESSION'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderPitch = () => (
    <View style={styles.pitchContainer}>
      <View style={styles.pitchHeader}>
        <MediapipeWeb style={styles.miniCamera} onMetrics={onMediapipeMetrics} />
        <View style={styles.headerOverlay}>
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
            <Text style={styles.roundLabel}>ROUND {roundNumber}</Text>
          </View>
          <AnimatedAvatar isSpeaking={isSpeaking} />
        </View>
      </View>
      <View style={styles.metricsBar}>
        <View style={styles.metricTiny}>
          <Text style={styles.metricTinyLabel}>CLARITY</Text>
          <Text style={[styles.metricTinyVal, {color: getScoreColor(sessionMetrics.clarityScore)}]}>
            {sessionMetrics.clarityScore}%
          </Text>
        </View>
        <View style={styles.metricTiny}>
          <Text style={styles.metricTinyLabel}>POSTURE</Text>
          <Text style={[styles.metricTinyVal, {color: getScoreColor(currentPosture)}]}>
            {currentPosture}%
          </Text>
        </View>
        <View style={styles.metricTiny}>
          <Text style={styles.metricTinyLabel}>EYE CONTACT</Text>
          <Text style={[styles.metricTinyVal, {color: getScoreColor(currentEyeContact)}]}>
            {currentEyeContact}%
          </Text>
        </View>
        <View style={styles.metricTiny}>
          <Text style={styles.metricTinyLabel}>SAMPLES</Text>
          <Text style={styles.metricTinyVal}>{visualSamples.length}</Text>
        </View>
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={styles.pitchChat}
        contentContainerStyle={{ paddingBottom: 20 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View key={i} style={[styles.messageBubble, m.role === 'user' ? styles.userBubble : styles.sharkBubble]}>
            <Text style={styles.messageText}>{m.content}</Text>
          </View>
        ))}
        {loading && <ActivityIndicator color="#00FF41" style={{ marginVertical: 10 }} />}
      </ScrollView>
      <View style={styles.pitchFooter}>
        <TouchableOpacity style={styles.endSessionBtn} onPress={endSession}>
          <Text style={styles.endBtnText}>END</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainMicBtn, isRecording && styles.micActive]}
          onPressIn={startRecording}
          onPressOut={stopAndProcess}
          disabled={loading}
        >
          <Text style={styles.micIcon}>{isRecording ? '⏹️' : '🎤'}</Text>
          <Text style={styles.micHint}>{isRecording ? 'RELEASE' : 'HOLD TO TALK'}</Text>
        </TouchableOpacity>
        <View style={styles.footerSpacer} />
      </View>
    </View>
  );

  const renderAnalysis = () => (
    <ScrollView style={styles.screenContainer} contentContainerStyle={styles.analysisContent}>
      <Text style={styles.analysisTitle}>SESSION COMPLETE</Text>
      <View style={styles.scoreGrid}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>CLARITY</Text>
          <Text style={[styles.scoreValue, {color: getScoreColor(sessionMetrics.clarityScore)}]}>
            {sessionMetrics.clarityScore}%
          </Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>CONFIDENCE</Text>
          <Text style={[styles.scoreValue, {color: getScoreColor(sessionMetrics.confidenceScore)}]}>
            {sessionMetrics.confidenceScore}%
          </Text>
        </View>
      </View>
      <View style={styles.scoreGrid}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>EYE CONTACT</Text>
          <Text style={[styles.scoreValue, {color: getScoreColor(sessionMetrics.eyeContactScore)}]}>
            {sessionMetrics.eyeContactScore}%
          </Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>POSTURE</Text>
          <Text style={[styles.scoreValue, {color: getScoreColor(sessionMetrics.postureScore)}]}>
            {sessionMetrics.postureScore}%
          </Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statCardTitle}>SESSION STATS</Text>
        <Text style={styles.statLine}>Words Spoken: {sessionMetrics.totalWords}</Text>
        <Text style={styles.statLine}>Filler Words: {sessionMetrics.fillerWords}</Text>
        <Text style={styles.statLine}>Rounds: {sessionMetrics.rounds}</Text>
        <Text style={styles.statLine}>Visual Samples: {visualSamples.length}</Text>
      </View>
      {visualFeedback && (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>🎯 PERFORMANCE ANALYSIS</Text>
          <Text style={styles.feedbackText}>{visualFeedback}</Text>
        </View>
      )}
      <TouchableOpacity style={styles.doneBtn} onPress={resetToHome}>
        <Text style={styles.doneBtnText}>BACK TO ARENA</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  switch (screen) {
    case 'setup': return renderSetup();
    case 'pitch': return renderPitch();
    case 'analysis': return renderAnalysis();
    default: return renderHome();
  }
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#000' },
  homeContent: { padding: 20, paddingTop: 60 },
  heroSection: { alignItems: 'center', marginBottom: 40 },
  heroEmoji: { fontSize: 80 },
  heroTitle: { color: '#00FF41', fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  heroSubtitle: { color: '#888', fontSize: 16, marginTop: 10, textAlign: 'center' },
  startButton: { backgroundColor: '#00FF41', padding: 20, borderRadius: 15, alignItems: 'center', marginVertical: 20 },
  startButtonText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
  tipsCard: { backgroundColor: '#111', padding: 20, borderRadius: 15, marginTop: 20, borderWidth: 1, borderColor: '#222' },
  tipsTitle: { color: '#00FF41', fontSize: 14, fontWeight: 'bold', marginBottom: 15 },
  tipItem: { color: '#888', fontSize: 14, marginBottom: 8 },
  setupContent: { padding: 20, paddingTop: 40 },
  backBtn: { marginBottom: 20 },
  backBtnText: { color: '#00FF41', fontSize: 16 },
  setupTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  setupSection: { marginBottom: 30 },
  sectionTitle: { color: '#00FF41', fontSize: 14, fontWeight: 'bold', marginBottom: 15 },
  sharkScroll: { marginBottom: 10 },
  sharkCard: { width: 140, backgroundColor: '#111', borderRadius: 15, padding: 15, marginRight: 15, borderWidth: 1, borderColor: '#222' },
  sharkEmoji: { fontSize: 30, marginBottom: 5 },
  sharkName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  sharkStyle: { color: '#666', fontSize: 11, marginTop: 5 },
  modeCard: { flexDirection: 'row', backgroundColor: '#111', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  modeCardSelected: { borderColor: '#00FF41', backgroundColor: '#00FF4110' },
  modeIcon: { fontSize: 24, marginRight: 15 },
  modeInfo: { flex: 1 },
  modeName: { color: '#fff', fontWeight: 'bold' },
  modeDesc: { color: '#666', fontSize: 12 },
  checkmark: { color: '#00FF41', fontSize: 20, fontWeight: 'bold' },
  beginButton: { backgroundColor: '#00FF41', padding: 20, borderRadius: 15, alignItems: 'center' },
  beginButtonDisabled: { backgroundColor: '#333' },
  beginButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  pitchContainer: { flex: 1, backgroundColor: '#000' },
  pitchHeader: { height: 360 },
  miniCamera: { flex: 1 },
  headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'space-between', padding: 15 },
  timerContainer: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 8 },
  timerText: { color: '#FF4444', fontSize: 20, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  roundLabel: { color: '#fff', fontSize: 10, textAlign: 'center' },
  metricsBar: { flexDirection: 'row', backgroundColor: '#111', padding: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  metricTiny: { flex: 1, alignItems: 'center' },
  metricTinyLabel: { color: '#666', fontSize: 8, fontWeight: 'bold' },
  metricTinyVal: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  pitchChat: { flex: 1, padding: 15 },
  messageBubble: { padding: 15, borderRadius: 20, marginBottom: 15, maxWidth: '85%' },
  userBubble: { backgroundColor: '#1A1A1A', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  sharkBubble: { backgroundColor: '#00FF4110', alignSelf: 'flex-start', borderBottomLeftRadius: 2, borderLeftWidth: 3, borderLeftColor: '#00FF41' },
  messageText: { color: '#fff', fontSize: 16 },
  pitchFooter: { height: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: '#050505' },
  endSessionBtn: { width: 60 },
  endBtnText: { color: '#666', fontWeight: 'bold' },
  mainMicBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#00FF41' },
  micActive: { backgroundColor: '#FF4444', borderColor: '#fff' },
  micIcon: { fontSize: 30 },
  micHint: { color: '#00FF41', fontSize: 8, marginTop: 4, fontWeight: 'bold' },
  footerSpacer: { width: 60 },
  analysisContent: { padding: 20, paddingTop: 60 },
  analysisTitle: { color: '#00FF41', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  scoreGrid: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  scoreBox: { flex: 1, backgroundColor: '#111', padding: 20, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  scoreLabel: { color: '#666', fontSize: 12, marginBottom: 10 },
  scoreValue: { fontSize: 32, fontWeight: 'bold' },
  statCard: { backgroundColor: '#111', padding: 20, borderRadius: 15, marginTop: 15, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  statCardTitle: { color: '#00FF41', fontSize: 14, fontWeight: 'bold', marginBottom: 15 },
  statLine: { color: '#ccc', fontSize: 16, marginBottom: 8 },
  feedbackCard: { backgroundColor: '#00FF4110', padding: 20, borderRadius: 15, marginBottom: 30, borderWidth: 2, borderColor: '#00FF41' },
  feedbackTitle: { color: '#00FF41', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  feedbackText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  doneBtn: { backgroundColor: '#00FF41', padding: 20, borderRadius: 15, alignItems: 'center' },
  doneBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  
  // Avatar Styles
  avatarContainer: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 12,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarEmoji: {
    fontSize: 60,
  },
  speakingLabel: {
    color: '#00FF41',
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 5,
  },
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    gap: 3,
  },
  soundWave: {
    width: 3,
    backgroundColor: '#00FF41',
    borderRadius: 2,
  },
});
