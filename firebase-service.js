import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const firebaseService = {
  auth,
  db,
  storage,
  user: null,
  profile: null,

  authReady: new Promise(resolve => {
    onAuthStateChanged(auth, async user => {
      firebaseService.user = user;
      firebaseService.profile = null;

      if (user) {
        firebaseService.profile = await firebaseService.getUserDocByUid(user.uid);
      }

      resolve(user);
    });
  }),

  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, async user => {
      firebaseService.user = user;
      firebaseService.profile = null;

      if (user) {
        firebaseService.profile = await firebaseService.getUserDocByUid(user.uid);
      }

      callback(user);
    });
  },

  async signUp(userData) {
    const credential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );

    const uid = credential.user.uid;
    const perfil = {
      uid,
      nome: userData.nome,
      email: userData.email,
      cpf: userData.cpf,
      telefone: userData.telefone || "",
      tipo: userData.tipo || "paciente",
      fotoPerfil: userData.fotoPerfil || "",
      dataCadastro: new Date().toISOString(),
      sexo: userData.sexo || "",
      estadoCivil: userData.estadoCivil || "",
      data: userData.data || "",
      estado: userData.estado || "",
      cidade: userData.cidade || "",
      bairro: userData.bairro || "",
      rua: userData.rua || "",
      numero: userData.numero || "",
      cargo: userData.cargo || "",
      registroProfissional: userData.registroProfissional || "",
      unidade: userData.unidade || "",
      especialidade: userData.especialidade || "",
      informacoesSaude: userData.informacoesSaude || "",
      exames: userData.exames || ""
    };

    await setDoc(doc(db, "usuarios", uid), perfil);
    firebaseService.profile = perfil;
    return perfil;
  },

  async signIn(email, password) {
    return await signInWithEmailAndPassword(auth, email, password);
  },

  async signOut() {
    return await firebaseSignOut(auth);
  },

  async sendPasswordReset(email) {
    return await sendPasswordResetEmail(auth, email);
  },

  async getUserDocByUid(uid) {
    const userDoc = await getDoc(doc(db, "usuarios", uid));
    if (!userDoc.exists()) return null;
    return { uid: userDoc.id, ...userDoc.data() };
  },

  async getUserDocByCpf(cpf) {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("cpf", "==", cpf));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const docSnap = querySnapshot.docs[0];
    return { uid: docSnap.id, ...docSnap.data() };
  },

  async updateUserDoc(uid, data) {
    const userDoc = doc(db, "usuarios", uid);
    await updateDoc(userDoc, data);
    return await this.getUserDocByUid(uid);
  },

  async getAllUsers() {
    const usuariosRef = collection(db, "usuarios");
    const querySnapshot = await getDocs(usuariosRef);
    return querySnapshot.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() }));
  },

  async getHistoricosByUsuarioId(uid) {
    const historicosRef = collection(db, "historicos");
    const q = query(historicosRef, where("usuarioId", "==", uid), orderBy("createdAt", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({ __docId: docSnap.id, ...docSnap.data() }));
  },

  async addHistorico(usuarioId, registro) {
    const historicosRef = collection(db, "historicos");
    const newRecord = {
      usuarioId,
      data: registro.data,
      sistolica: registro.sistolica,
      diastolica: registro.diastolica,
      glicemia: registro.glicemia,
      medicamentos: registro.medicamentos || "",
      sintomas: registro.sintomas || "",
      pressao: registro.pressao || `${registro.sistolica}/${registro.diastolica}`,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(historicosRef, newRecord);
    const snapshot = await getDoc(docRef);
    return { __docId: docRef.id, ...snapshot.data() };
  },

  async updateHistorico(docId, registro) {
    const historicoDoc = doc(db, "historicos", docId);
    const updateData = {
      data: registro.data,
      sistolica: registro.sistolica,
      diastolica: registro.diastolica,
      glicemia: registro.glicemia,
      medicamentos: registro.medicamentos || "",
      sintomas: registro.sintomas || "",
      pressao: registro.pressao || `${registro.sistolica}/${registro.diastolica}`
    };

    await updateDoc(historicoDoc, updateData);
    return { __docId: docId, ...updateData };
  },

  async deleteHistoricoById(docId) {
    await deleteDoc(doc(db, "historicos", docId));
  },

  async getConsultas() {
    const consultasRef = collection(db, "consultas");
    const querySnapshot = await getDocs(consultasRef);
    return querySnapshot.docs.map(docSnap => ({ __docId: docSnap.id, ...docSnap.data() }));
  },

  async addConsulta(consulta) {
    const consultasRef = collection(db, "consultas");
    const record = {
      pacienteId: consulta.pacienteId,
      profissionalId: consulta.profissionalId || "",
      pacienteNome: consulta.pacienteNome,
      data: consulta.data,
      hora: consulta.hora,
      status: consulta.status || "Pendente",
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(consultasRef, record);
    const snapshot = await getDoc(docRef);
    return { __docId: docRef.id, ...snapshot.data() };
  },

  async updateConsulta(docId, data) {
    await updateDoc(doc(db, "consultas", docId), data);
  },

  async deleteUser(uid) {
    await deleteDoc(doc(db, "usuarios", uid));
  },

  async uploadProfilePhoto(uid, file) {
    const storageRef = ref(storage, `profile_photos/${uid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await updateDoc(doc(db, "usuarios", uid), { fotoPerfil: url });
    return url;
  },

  async deleteHistoricosByUsuarioId(uid) {
    const historicosRef = collection(db, "historicos");
    const q = query(historicosRef, where("usuarioId", "==", uid));
    const querySnapshot = await getDocs(q);
    const promises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "historicos", docSnap.id)));
    await Promise.all(promises);
  },

  async deleteConsultasByUsuarioId(uid) {
    const consultasRef = collection(db, "consultas");
    const q1 = query(consultasRef, where("pacienteId", "==", uid));
    const q2 = query(consultasRef, where("profissionalId", "==", uid));
    const snap1 = await getDocs(q1);
    const snap2 = await getDocs(q2);
    const promises = [...snap1.docs, ...snap2.docs].map(docSnap => deleteDoc(doc(db, "consultas", docSnap.id)));
    await Promise.all(promises);
  }
};

window.firebaseService = firebaseService;
