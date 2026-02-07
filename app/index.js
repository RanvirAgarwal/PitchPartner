import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView, Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// --- CONFIGURATION ---
const FEATHERLESS_API_KEY = 'rc_1a19fe2efea58e9740fa15291133f16d8c2c3238a179a48e566250e032251fbc'; 
const MODEL_ID = "Qwen/Qwen2.5-72B-Instruct"; // UNGATED & HIGH LOGIC

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [personality, setPersonality] = useState('Skeptical Investor');
  const [isRoastMode, setIsRoastMode] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "I'm the investor. Pitch me your idea, and make it quick. My time is money." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef();

  // Handling Camera Permissions
  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pitch Partner Needs Camera</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const personalities = {
    'Skeptical Investor': "You are a blunt Shark Tank investor. You focus on profit, margins, and market gaps. You hate fluff.",
    'Micro-manager': "You focus on the tiny details. Ask about specific buttons, code libraries, and exact hourly costs.",
    'The Visionary': "You hate details. Ask how this 'disrupts the human experience' or 'changes the galaxy'."
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    let systemPrompt = personalities[personality];
    if (isRoastMode) {
      systemPrompt += " Also, be incredibly mean and condescending. Call their ideas 'amateur hour' and look for any excuse to kick them out.";
    }

    try {
      const response = await fetch("https://api.featherless.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${FEATHERLESS_API_KEY}`
        },
        body: JSON.stringify({
          "model": MODEL_ID,
          "messages": [
            { role: 'system', content: systemPrompt },
            ...updatedMessages
          ],
          "temperature": isRoastMode ? 0.9 : 0.7
        })
      });

      const data = await response.json();
      
      if (data.choices && data.choices[0]) {
        setMessages([...updatedMessages, data.choices[0].message]);
      } else {
        alert("API Error: " + (data.error?.message || "Check your key/credits"));
      }
    } catch (error) {
      alert("Network Error: Could not reach Featherless AI.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Camera View */}
      <View style={styles.header}>
        <Text style={styles.title}>PITCH PARTNER</Text>
        
        <View style={styles.viewfinderContainer}>
          <CameraView style={styles.viewfinder} facing="front" />
          <View style={styles.scanLine} />
        </View>

        <View style={styles.pickerRow}>
          {Object.keys(personalities).map((p) => (
            <TouchableOpacity 
              key={p} 
              onPress={() => {
                setPersonality(p);
                setMessages([{role:'assistant', content: `Switched to ${p} mode. Make your case.`}]);
              }}
              style={[styles.chip, personality === p && styles.activeChip]}
            >
              <Text style={[styles.chipText, personality === p && styles.activeChipText]}>{p.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.roastRow}>
          <Text style={styles.roastLabel}>ROAST MODE</Text>
          <Switch 
            value={isRoastMode} 
            onValueChange={setIsRoastMode} 
            trackColor={{ false: "#333", true: "#FF4444" }}
          />
        </View>
      </View>

      {/* Chat Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.chat}
        onContentSizeChange={() => scrollViewRef.current.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View key={i} style={[styles.msg, m.role === 'user' ? styles.userMsg : styles.botMsg]}>
            <Text style={styles.msgText}>{m.content}</Text>
          </View>
        ))}
        {loading && <ActivityIndicator color="#00FF41" style={{ margin: 20 }} />}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.footer}>
          <TextInput 
            style={styles.input} 
            value={input} 
            onChangeText={setInput} 
            placeholder="Convince me..." 
            placeholderTextColor="#666"
          />
          <TouchableOpacity style={styles.btn} onPress={sendMessage}>
            <Text style={styles.btnText}>PITCH</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingTop: 50, paddingBottom: 15, backgroundColor: '#111', alignItems: 'center' },
  title: { color: '#00FF41', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  viewfinderContainer: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', borderWidth: 2, borderColor: '#00FF41', marginTop: 10 },
  viewfinder: { flex: 1 },
  scanLine: { position: 'absolute', width: '100%', height: 2, backgroundColor: '#00FF41', top: '50%', opacity: 0.5 },
  pickerRow: { flexDirection: 'row', marginTop: 15 },
  roastRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  roastLabel: { color: '#FF4444', fontSize: 10, fontWeight: 'bold', marginRight: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#333', marginHorizontal: 4 },
  activeChip: { backgroundColor: '#00FF41', borderColor: '#00FF41' },
  chipText: { color: '#888', fontSize: 11 },
  activeChipText: { color: '#000', fontWeight: 'bold' },
  chat: { flex: 1, padding: 15 },
  msg: { padding: 15, borderRadius: 20, marginVertical: 8, maxWidth: '85%' },
  userMsg: { backgroundColor: '#1A1A1A', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  botMsg: { backgroundColor: '#00FF4115', alignSelf: 'flex-start', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#00FF4133' },
  msgText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  footer: { flexDirection: 'row', padding: 20, backgroundColor: '#111' },
  input: { flex: 1, backgroundColor: '#222', borderRadius: 25, paddingHorizontal: 20, color: '#fff', height: 45 },
  btn: { marginLeft: 10, backgroundColor: '#00FF41', borderRadius: 25, paddingHorizontal: 20, justifyContent: 'center' },
  btnText: { fontWeight: 'bold', color: '#000' }
});