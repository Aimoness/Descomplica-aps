const SUPABASE_URL = "https://qcnhmffxzlxpkctnexwg.supabase.co";
const SUPABASE_KEY = "sb_publishable_9kriS76EBT36WXUuGPrlYA_g96yxXi5";
const SUPABASE_REST_URL = `${SUPABASE_URL}/rest/v1`;
const SUPABASE_AUTH_URL = `${SUPABASE_URL}/auth/v1`;

const SUPABASE_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation"
};

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

function generateLocalId(prefix = "local") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_REST_URL}${path}`;
  const res = await fetch(url, {
    headers: SUPABASE_HEADERS,
    credentials: "same-origin",
    ...options
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase request failed ${res.status}: ${body}`);
  }

  return res;
}

async function supabaseAuthFetch(path, options = {}) {
  const url = `${SUPABASE_AUTH_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...options.headers
    },
    credentials: "same-origin",
    ...options
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase auth request failed ${res.status}: ${body}`);
  }

  return res;
}

function buildFilter(field, operator, value) {
  return `${field}=${operator}.${encodeURIComponent(value)}`;
}

const firebaseService = {
  user: null,
  profile: null,
  localMode: false,

  authReady: null,

  onAuthStateChanged(callback) {
    callback(firebaseService.user);
    return {
      unsubscribe() {}
    };
  },

  async signUp(userData) {
    const body = JSON.stringify({
      email: userData.email,
      password: userData.password
    });
    console.log("[supabase-service] signUp request body:", userData);
    let res;
    let data;
    try {
      res = await supabaseAuthFetch("/signup", {
        method: "POST",
        body
      });
      data = await res.json();
    } catch (err) {
      const msg = String(err?.message || "");
      console.warn("[supabase-service] signUp request failed:", err);
      
      // Handle Supabase email send rate limit: allow local fallback so 'primeiro acesso' works
      if (msg.includes('over_email_send_rate_limit') || msg.includes('429')) {
        console.warn('[supabase-service] Supabase email rate limit exceeded — falling back to local mode');
        enableLocalMode();
        const localUid = generateLocalId('user');
        const perfilLocal = {
          uid: localUid,
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
        saveLocalAuth({ uid: localUid, email: userData.email });
        saveLocalData(localStorageKeys.usuarios, [...getLocalUsers(), perfilLocal]);
        firebaseService.profile = perfilLocal;
        return perfilLocal;
      }
      
      // If duplicate email, try to recover existing perfil from users table
      if (msg.includes('23505') || msg.toLowerCase().includes('duplicate key')) {
        try {
          const resp = await supabaseFetch(`/usuarios?select=*&email=eq.${encodeURIComponent(userData.email)}`);
          const results = await resp.json();
          if (results && results.length > 0) {
            const existing = results[0];
            saveLocalAuth({ uid: existing.uid || generateLocalId('user'), email: userData.email });
            firebaseService.profile = existing;
            return existing;
          }
        } catch (e2) {
          console.warn('[supabase-service] failed to fetch existing perfil after duplicate email (auth)', e2);
        }
      }
      throw err;
    }
    console.log("[supabase-service] signUp response:", data);
    const user = data.user || data;
    const uid = user?.id || generateLocalId("user");

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

    // Map to snake_case for PostgREST (Supabase) if DB uses snake_case
    function toSnake(perf) {
      return {
        uid: perf.uid,
        nome: perf.nome,
        email: perf.email,
        cpf: perf.cpf,
        telefone: perf.telefone,
        tipo: perf.tipo,
        foto_perfil: perf.fotoPerfil,
        data_cadastro: perf.dataCadastro,
        sexo: perf.sexo,
        estado_civil: perf.estadoCivil,
        data: perf.data,
        estado: perf.estado,
        cidade: perf.cidade,
        bairro: perf.bairro,
        rua: perf.rua,
        numero: perf.numero,
        cargo: perf.cargo,
        registro_profissional: perf.registroProfissional,
        unidade: perf.unidade,
        especialidade: perf.especialidade,
        informacoes_saude: perf.informacoesSaude,
        exames: perf.exames
      };
    }

    try {
      const bodyToInsert = toSnake(perfil);

      // First, create a minimal profile to avoid schema mismatch
      const minimal = {
        uid: bodyToInsert.uid,
        nome: bodyToInsert.nome,
        email: bodyToInsert.email,
        cpf: bodyToInsert.cpf
      };

      let response = await supabaseFetch(`/usuarios`, {
        method: "POST",
        body: JSON.stringify(minimal)
      });
      let inserted = await response.json();
      let record = Array.isArray(inserted) ? inserted[0] : inserted;

      saveLocalAuth({ uid, email: userData.email });

      // Then try to PATCH the rest of the fields (best-effort)
      try {
        await supabaseFetch(`/usuarios?uid=eq.${encodeURIComponent(uid)}`, {
          method: "PATCH",
          body: JSON.stringify(bodyToInsert)
        });

        // fetch updated record
        const fetchResp = await supabaseFetch(`/usuarios?select=*&uid=eq.${encodeURIComponent(uid)}`);
        const fetched = await fetchResp.json();
        if (fetched && fetched.length > 0) record = fetched[0];
      } catch (patchErr) {
        console.warn('[supabase-service] PATCH to update perfil failed, keeping minimal record', patchErr);
      }

      firebaseService.profile = record || perfil;
      return firebaseService.profile;
    } catch (error) {
      const msg = String(error?.message || "");

      // If duplicate email in auth or insert, try to recover existing profile by email
      if (msg.includes('23505') || msg.toLowerCase().includes('duplicate key')) {
        console.warn('[supabase-service] email duplicate — attempting to load existing perfil');
        try {
          const resp = await supabaseFetch(`/usuarios?select=*&email=eq.${encodeURIComponent(userData.email)}`);
          const results = await resp.json();
          if (results && results.length > 0) {
            const existing = results[0];
            saveLocalAuth({ uid: existing.uid || uid, email: userData.email });
            firebaseService.profile = existing;
            return existing;
          }
        } catch (err2) {
          console.warn('[supabase-service] failed to fetch existing perfil after duplicate email', err2);
        }
      }

      if (msg.includes("permission") || msg.includes("401")) {
        enableLocalMode();
        saveLocalAuth({ uid, email: userData.email });
        saveLocalData(localStorageKeys.usuarios, [...getLocalUsers(), perfil]);
        firebaseService.profile = perfil;
        return perfil;
      }
      throw error;
    }
  },

  async signIn(email, password) {
    const params = new URLSearchParams();
    params.set("grant_type", "password");
    params.set("email", email);
    params.set("password", password);

    const res = await supabaseAuthFetch("/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const data = await res.json();
    const user = data.user;
    if (!user) {
      throw new Error("Falha ao autenticar com Supabase.");
    }

    firebaseService.user = { uid: user.id, email: user.email };
    saveLocalAuth({ uid: user.id, email: user.email, access_token: data.access_token });
    return { user: firebaseService.user, session: data };
  },

  async signOut() {
    const authData = loadLocalAuth();
    try {
      if (authData?.access_token) {
        await supabaseAuthFetch("/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authData.access_token}`
          }
        });
      }
    } catch {
      // ignore logout errors
    }
    clearLocalAuth();
    firebaseService.user = null;
    firebaseService.profile = null;
  },

  async sendPasswordReset(email) {
    const res = await supabaseAuthFetch("/recover", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    return res.json();
  },

  async getUserDocByUid(uid) {
    try {
      const res = await supabaseFetch(`/usuarios?select=*&uid=eq.${encodeURIComponent(uid)}`);
      const results = await res.json();
      if (!results || results.length === 0) {
        return getLocalUsers().find(u => u.uid === uid) || null;
      }
      return results[0];
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        return getLocalUsers().find(u => u.uid === uid) || null;
      }
      throw error;
    }
  },

  async getUserDocByCpf(cpf) {
    try {
      const res = await supabaseFetch(`/usuarios?select=*&cpf=eq.${encodeURIComponent(cpf)}`);
      const results = await res.json();
      if (!results || results.length === 0) {
        return getLocalUsers().find(u => u.cpf === cpf) || null;
      }
      return results[0];
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        return getLocalUsers().find(u => u.cpf === cpf) || null;
      }
      throw error;
    }
  },

  async updateUserDoc(uid, data) {
    try {
      const response = await supabaseFetch(`/usuarios?uid=eq.${encodeURIComponent(uid)}`, {
        method: "PATCH",
        body: JSON.stringify(data)
      });
      const updated = await response.json();
      return Array.isArray(updated) ? updated[0] : updated;
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
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
      const response = await supabaseFetch(`/usuarios?select=*`);
      return await response.json();
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        return getLocalUsers();
      }
      throw error;
    }
  },

  async getHistoricosByUsuarioId(uid) {
    try {
      const response = await supabaseFetch(`/historicos?select=*&usuarioId=eq.${encodeURIComponent(uid)}&order=createdAt.asc`);
      return await response.json();
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
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
      createdAt: new Date().toISOString()
    };

    try {
      const response = await supabaseFetch(`/historicos`, {
        method: "POST",
        body: JSON.stringify(newRecord)
      });
      const inserted = await response.json();
      return Array.isArray(inserted) ? inserted[0] : inserted;
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        saveLocalHistorico(newRecord);
        return newRecord;
      }
      throw error;
    }
  },

  async updateHistorico(docId, registro) {
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
      const response = await supabaseFetch(`/historicos?__docId=eq.${encodeURIComponent(docId)}`, {
        method: "PATCH",
        body: JSON.stringify(updateData)
      });
      const updated = await response.json();
      return Array.isArray(updated) ? updated[0] : { __docId: docId, ...updateData };
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        updateLocalHistorico(docId, updateData);
        return { __docId: docId, ...updateData };
      }
      throw error;
    }
  },

  async deleteHistoricoById(docId) {
    try {
      await supabaseFetch(`/historicos?__docId=eq.${encodeURIComponent(docId)}`, {
        method: "DELETE"
      });
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        deleteLocalHistoricoById(docId);
        return;
      }
      throw error;
    }
  },

  async getConsultas() {
    try {
      const response = await supabaseFetch(`/consultas?select=*`);
      return await response.json();
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
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
      createdAt: new Date().toISOString()
    };
    try {
      const response = await supabaseFetch(`/consultas`, {
        method: "POST",
        body: JSON.stringify(record)
      });
      const inserted = await response.json();
      return Array.isArray(inserted) ? inserted[0] : inserted;
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        saveLocalConsulta(record);
        return record;
      }
      throw error;
    }
  },

  async updateConsulta(docId, data) {
    try {
      await supabaseFetch(`/consultas?__docId=eq.${encodeURIComponent(docId)}`, {
        method: "PATCH",
        body: JSON.stringify(data)
      });
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        updateLocalConsulta(docId, data);
        return;
      }
      throw error;
    }
  },

  async deleteUser(uid) {
    try {
      await supabaseFetch(`/usuarios?uid=eq.${encodeURIComponent(uid)}`, {
        method: "DELETE"
      });
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        const usuarios = getLocalUsers().filter(user => user.uid !== uid);
        saveLocalData(localStorageKeys.usuarios, usuarios);
        return;
      }
      throw error;
    }
  },

  async uploadProfilePhoto(uid, file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const updateData = { fotoPerfil: dataUrl };
    const updated = await this.updateUserDoc(uid, updateData);
    return updated?.fotoPerfil || dataUrl;
  },

  async deleteHistoricosByUsuarioId(uid) {
    try {
      await supabaseFetch(`/historicos?usuarioId=eq.${encodeURIComponent(uid)}`, {
        method: "DELETE"
      });
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        const historicos = getLocalHistoricos().filter(item => item.usuarioId !== uid);
        saveLocalData(localStorageKeys.historicos, historicos);
        return;
      }
      throw error;
    }
  },

  async deleteConsultasByUsuarioId(uid) {
    try {
      await supabaseFetch(`/consultas?pacienteId=eq.${encodeURIComponent(uid)}`, {
        method: "DELETE"
      });
      await supabaseFetch(`/consultas?profissionalId=eq.${encodeURIComponent(uid)}`, {
        method: "DELETE"
      });
    } catch (error) {
      if (error.message.includes("permission") || error.message.includes("401")) {
        enableLocalMode();
        const consultas = getLocalConsultas().filter(
          item => item.pacienteId !== uid && item.profissionalId !== uid
        );
        saveLocalData(localStorageKeys.consultas, consultas);
        return;
      }
      throw error;
    }
  }
};

window.firebaseService = firebaseService;

// Initialize authReady after the service object is fully defined
firebaseService.authReady = (async () => {
  const localAuth = loadLocalAuth();
  if (localAuth?.uid) {
    firebaseService.user = localAuth;
    try {
      firebaseService.profile = await firebaseService.getUserDocByUid(localAuth.uid);
    } catch (e) {
      console.warn("[supabase-service] failed to load profile during authReady:", e);
      firebaseService.profile = null;
    }
  }
  return firebaseService.user;
})();
