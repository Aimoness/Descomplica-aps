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
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

const localStorageKeys = {
  usuarios: "local_db_usuarios",
  historicos: "local_db_historicos",
  consultas: "local_db_consultas",
  auth: "local_auth_user"
};

function parseLocalData(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveLocalData(key, data) {
  localStorage.setItem(key, JSON.stringify(data || []));
}

function generateLocalId(prefix = "local") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isPermissionDeniedError(error) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  return (
    error?.code === "permission-denied" ||
    msg.includes("missing or insufficient permissions")
  );
}

function getLocalUsers() {
  return parseLocalData(localStorageKeys.usuarios);
}

function getLocalHistoricos() {
  return parseLocalData(localStorageKeys.historicos);
}

function getLocalConsultas() {
  return parseLocalData(localStorageKeys.consultas);
}

function saveLocalUser(user) {
  const usuarios = getLocalUsers();
  const index = usuarios.findIndex(u => u.uid === user.uid);
  if (index !== -1) {
    usuarios[index] = user;
  } else {
    usuarios.push(user);
  }
  saveLocalData(localStorageKeys.usuarios, usuarios);
}

function saveLocalHistorico(registro) {
  const historicos = getLocalHistoricos();
  historicos.push(registro);
  saveLocalData(localStorageKeys.historicos, historicos);
}

function saveLocalConsulta(consulta) {
  const consultas = getLocalConsultas();
  consultas.push(consulta);
  saveLocalData(localStorageKeys.consultas, consultas);
}

function deleteLocalHistoricoById(docId) {
  const historicos = getLocalHistoricos().filter(item => item.__docId !== docId);
  saveLocalData(localStorageKeys.historicos, historicos);
}

function updateLocalHistorico(docId, registro) {
  const historicos = getLocalHistoricos();
  const index = historicos.findIndex(item => item.__docId === docId);
  if (index !== -1) {
    historicos[index] = { __docId: docId, ...registro };
    saveLocalData(localStorageKeys.historicos, historicos);
  }
}

function updateLocalConsulta(docId, data) {
  const consultas = getLocalConsultas();
  const index = consultas.findIndex(item => item.__docId === docId);
  if (index !== -1) {
    consultas[index] = { __docId: docId, ...data };
    saveLocalData(localStorageKeys.consultas, consultas);
  }
}

function saveLocalAuth(authData) {
  localStorage.setItem(localStorageKeys.auth, JSON.stringify(authData || null));
}

function loadLocalAuth() {
  try {
    return JSON.parse(localStorage.getItem(localStorageKeys.auth) || "null");
  } catch {
    return null;
  }
}

function clearLocalAuth() {
  localStorage.removeItem(localStorageKeys.auth);
}

function enableLocalMode() {
  window.firebaseService = window.firebaseService || {};
  if (window.firebaseService) {
    window.firebaseService.localMode = true;
  }
}

const firebaseService = {
  auth,
  db,
  storage,
  user: null,
  profile: null,
  localMode: false,

  authReady: new Promise(resolve => {
    onAuthStateChanged(auth, async user => {
      if (user) {
        firebaseService.user = user;
        firebaseService.profile = await firebaseService.getUserDocByUid(user.uid);
        saveLocalAuth({ uid: user.uid, email: user.email });
      } else {
        const localAuth = loadLocalAuth();
        if (localAuth?.uid) {
          firebaseService.user = { uid: localAuth.uid, email: localAuth.email };
          firebaseService.profile = await firebaseService.getUserDocByUid(localAuth.uid);
        } else {
          firebaseService.user = null;
          firebaseService.profile = null;
        }
      }
      resolve(firebaseService.user);
    });
  }),

  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, async user => {
      if (user) {
        firebaseService.user = user;
        firebaseService.profile = await firebaseService.getUserDocByUid(user.uid);
        saveLocalAuth({ uid: user.uid, email: user.email });
      } else {
        const localAuth = loadLocalAuth();
        if (localAuth?.uid) {
          firebaseService.user = { uid: localAuth.uid, email: localAuth.email };
          firebaseService.profile = await firebaseService.getUserDocByUid(localAuth.uid);
        } else {
          firebaseService.user = null;
          firebaseService.profile = null;
        }
      }
      callback(firebaseService.user);
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

    try {
      await setDoc(doc(db, "usuarios", uid), perfil);
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        console.warn("Firestore write denied, saving local profile instead.", error);
        enableLocalMode();
        saveLocalUser(perfil);
      } else {
        throw error;
      }
    }

    saveLocalAuth({ uid, email: userData.email });
    firebaseService.profile = perfil;
    return perfil;
  },

  async signIn(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    saveLocalAuth({ uid: credential.user.uid, email });
    return credential;
  },

  async signOut() {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore if there is no active Firebase auth session
    }
    clearLocalAuth();
    firebaseService.user = null;
    firebaseService.profile = null;
  },

  async sendPasswordReset(email) {
    return await sendPasswordResetEmail(auth, email);
  },

  async getUserDocByUid(uid) {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", uid));
      if (!userDoc.exists()) {
        const local = getLocalUsers().find(u => u.uid === uid);
        return local || null;
      }
      return { uid: userDoc.id, ...userDoc.data() };
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        return getLocalUsers().find(u => u.uid === uid) || null;
      }
      throw error;
    }
  },

  async getUserDocByCpf(cpf) {
    try {
      const usuariosRef = collection(db, "usuarios");
      const q = query(usuariosRef, where("cpf", "==", cpf));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return getLocalUsers().find(u => u.cpf === cpf) || null;
      }
      const docSnap = querySnapshot.docs[0];
      return { uid: docSnap.id, ...docSnap.data() };
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        return getLocalUsers().find(u => u.cpf === cpf) || null;
      }
      throw error;
    }
  },

  async updateUserDoc(uid, data) {
    try {
      const userDoc = doc(db, "usuarios", uid);
      await updateDoc(userDoc, data);
      return await this.getUserDocByUid(uid);
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        const usuarios = getLocalUsers();
        const index = usuarios.findIndex(user => user.uid === uid);
        if (index !== -1) {
          usuarios[index] = { ...usuarios[index], ...data };
          saveLocalData(localStorageKeys.usuarios, usuarios);
          return usuarios[index];
        }
        return null;
      }
      throw error;
    }
  },

  async getAllUsers() {
    try {
      const usuariosRef = collection(db, "usuarios");
      const querySnapshot = await getDocs(usuariosRef);
      return querySnapshot.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() }));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        return getLocalUsers();
      }
      throw error;
    }
  },

  async getHistoricosByUsuarioId(uid) {
    try {
      const historicosRef = collection(db, "historicos");
      const q = query(historicosRef, where("usuarioId", "==", uid), orderBy("createdAt", "asc"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(docSnap => ({ __docId: docSnap.id, ...docSnap.data() }));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        return getLocalHistoricos().filter(item => item.usuarioId === uid);
      }
      throw error;
    }
  },

  async addHistorico(usuarioId, registro) {
    const newRecord = {
      __docId: generateLocalId("hist"),
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

    try {
      const historicosRef = collection(db, "historicos");
      const docRef = await addDoc(historicosRef, newRecord);
      const snapshot = await getDoc(docRef);
      return { __docId: docRef.id, ...snapshot.data() };
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        saveLocalHistorico(newRecord);
        return newRecord;
      }
      throw error;
    }
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

    try {
      await updateDoc(historicoDoc, updateData);
      return { __docId: docId, ...updateData };
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        updateLocalHistorico(docId, updateData);
        return { __docId: docId, ...updateData };
      }
      throw error;
    }
  },

  async deleteHistoricoById(docId) {
    try {
      await deleteDoc(doc(db, "historicos", docId));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        deleteLocalHistoricoById(docId);
        return;
      }
      throw error;
    }
  },

  async getConsultas() {
    try {
      const consultasRef = collection(db, "consultas");
      const querySnapshot = await getDocs(consultasRef);
      return querySnapshot.docs.map(docSnap => ({ __docId: docSnap.id, ...docSnap.data() }));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        return getLocalConsultas();
      }
      throw error;
    }
  },

  async addConsulta(consulta) {
    const record = {
      __docId: generateLocalId("cons"),
      pacienteId: consulta.pacienteId,
      profissionalId: consulta.profissionalId || "",
      pacienteNome: consulta.pacienteNome,
      data: consulta.data,
      hora: consulta.hora,
      status: consulta.status || "Pendente",
      createdAt: serverTimestamp()
    };
    try {
      const consultasRef = collection(db, "consultas");
      const docRef = await addDoc(consultasRef, record);
      const snapshot = await getDoc(docRef);
      return { __docId: docRef.id, ...snapshot.data() };
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        saveLocalConsulta(record);
        return record;
      }
      throw error;
    }
  },

  async updateConsulta(docId, data) {
    try {
      await updateDoc(doc(db, "consultas", docId), data);
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        updateLocalConsulta(docId, data);
        return;
      }
      throw error;
    }
  },

  async deleteUser(uid) {
    try {
      await deleteDoc(doc(db, "usuarios", uid));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        enableLocalMode();
        const usuarios = getLocalUsers().filter(user => user.uid !== uid);
        saveLocalData(localStorageKeys.usuarios, usuarios);
        return;
      }
      throw error;
    }
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
