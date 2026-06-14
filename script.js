// =============================
// CONFIG
// =============================
let editandoIndex = null;

// =============================
// SUPABASE STATE
// =============================
const appState = {
  currentUser: null,
  currentProfile: null,
  usuarios: [],
  consultas: [],
  historicos: {},
  temaPainel: "claro"
};

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function getTipoEscolhido() {
  return window.tipoEscolhido || getQueryParam("tipo") || "paciente";
}

async function carregarUsuarios() {
  if (!window.firebaseService) return [];
  appState.usuarios = await window.firebaseService.getAllUsers();
  return appState.usuarios;
}

async function carregarConsultas() {
  if (!window.firebaseService) return [];
  appState.consultas = await window.firebaseService.getConsultas();
  return appState.consultas;
}

async function carregarHistorico(cpf) {
  if (!cpf || !window.firebaseService) return [];
  let usuario = appState.usuarios.find(u => u.cpf === cpf);

  if (!usuario) {
    usuario = await window.firebaseService.getUserDocByCpf(cpf);
  }

  if (!usuario) return [];

  const historicos = await window.firebaseService.getHistoricosByUsuarioId(usuario.uid);
  appState.historicos[cpf] = historicos;
  return historicos;
}

function escaparHTML(valor = "") {
  return String(valor).replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[caractere]));
}

// =============================
// UTILIDADES
// =============================
function obterValor(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function lerArquivoComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function definirTexto(id, texto) {
  const el = document.getElementById(id);

  if (el) {
    el.innerText = texto;
  }
}

function definirDisplayPorClasse(classe, display) {
  document.querySelectorAll("." + classe).forEach(el => {
    el.style.display = display;
  });
}

// =============================
// MENSAGEM
// =============================
function mostrarMensagem(texto, tipo = "sucesso") {

  const div = document.getElementById("mensagem");

  if (!div) {
    alert(texto);
    return;
  }

  const estilos = {
    sucesso: {
      cor: "#2ecc71",
      icone: ""
    },

    erro: {
      cor: "#e74c3c",
      icone: ""
    },

    aviso: {
      cor: "#f39c12",
      icone: ""
    }
  };

  const config = estilos[tipo] || estilos.sucesso;

  const msg = document.createElement("div");

  msg.style.background = config.cor;
  msg.style.color = "#fff";
  msg.style.padding = "14px 18px";
  msg.style.marginBottom = "10px";
  msg.style.borderRadius = "10px";
  msg.style.fontSize = "14px";
  msg.style.fontWeight = "600";
  msg.style.boxShadow = "0 6px 20px rgba(0,0,0,0.15)";
  msg.style.display = "flex";
  msg.style.alignItems = "center";
  msg.style.gap = "10px";

  msg.innerHTML = `
    <span style="font-size:18px;">
      ${config.icone}
    </span>

    <span>
      ${texto}
    </span>
  `;

  div.appendChild(msg);

  setTimeout(() => {

    msg.style.opacity = "0";
    msg.style.transform = "translateX(20px)";
    msg.style.transition = "0.3s";

    setTimeout(() => {
      msg.remove();
    }, 300);

  }, 2500);
}

// =============================
// CPF
// =============================
function limparCPF(cpf = "") {
  return String(cpf).replace(/\D/g, "");
}

function formatarCPF(cpf = "") {
  cpf = limparCPF(cpf);

  return cpf.replace(
    /(\d{3})(\d{3})(\d{3})(\d{2})/,
    "$1.$2.$3-$4"
  );
}

function mascaraCPF(input) {
  if (!input) return;

  let valor = limparCPF(input.value);

  if (valor.length > 11) {
    valor = valor.slice(0, 11);
  }

  valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
  valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
  valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");

  input.value = valor;
}

function cpfValido(cpf) {
  cpf = limparCPF(cpf);

  if (cpf.length !== 11) return false;

  if (/^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }

  resto = (soma * 10) % 11;

  if (resto === 10 || resto === 11) resto = 0;

  if (resto !== parseInt(cpf.substring(9, 10))) {
    return false;
  }

  soma = 0;

  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }

  resto = (soma * 10) % 11;

  if (resto === 10 || resto === 11) resto = 0;

  return resto === parseInt(cpf.substring(10, 11));
}

// =============================
// SENHA
// =============================
function toggleSenha(id) {
  const input = document.getElementById(id);

  if (!input) return;

  input.type =
    input.type === "password"
      ? "text"
      : "password";
}

// =============================
// LOGIN
// =============================
async function login() {
  const email = obterValor("email");
  const senhaDigitada = obterValor("senha");

  if (!email || !senhaDigitada) {
    mostrarMensagem("Preencha e-mail e senha", "erro");
    return;
  }

  try {
    await window.firebaseService.signIn(email, senhaDigitada);
    appState.currentUser = window.firebaseService.user;
    appState.currentProfile = await window.firebaseService.getUserDocByUid(appState.currentUser.uid);
    await carregarUsuarios();
    await carregarConsultas();

    mostrarMensagem("Login realizado!", "sucesso");

    setTimeout(() => {
      if (appState.currentProfile.tipo === "profissional") {
        window.location.href = "dashboard_profissional.html";
      } else {
        window.location.href = "dashboard_paciente.html";
      }
    }, 800);
  } catch (error) {
    mostrarMensagem("E-mail ou senha inválidos", "erro");
    console.error(error);
  }
}

// =============================
// VERIFICA LOGIN
// =============================
async function verificarLogin() {
  await window.firebaseService.authReady;

  if (!window.firebaseService.user) {
    window.location.href = "index.html";
    return false;
  }

  appState.currentUser = window.firebaseService.user;
  appState.currentProfile = await window.firebaseService.getUserDocByUid(appState.currentUser.uid);
  await carregarUsuarios();
  await carregarConsultas();

  return true;
}

// =============================
// VERIFICA PERFIL
// =============================
async function verificarPerfil(tipoEsperado) {
  const loggedIn = await verificarLogin();
  if (!loggedIn) return;

  const tipo = appState.currentProfile?.tipo;
  const permitido = Array.isArray(tipoEsperado)
    ? tipoEsperado.includes(tipo)
    : tipo === tipoEsperado;

  if (!permitido) {
    mostrarMensagem("Acesso negado", "erro");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  }
}

// =============================
// LOGOUT
// =============================
async function logout() {
  const confirmar = confirm("Deseja realmente sair?");
  if (!confirmar) return;

  try {
    await window.firebaseService.signOut();
    appState.currentUser = null;
    appState.currentProfile = null;
    mostrarMensagem("Logout realizado!", "sucesso");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 500);
  } catch (error) {
    console.error(error);
    mostrarMensagem("Erro ao sair. Tente novamente.", "erro");
  }
}

// =============================
// PRIMEIRO ACESSO
// =============================
function primeiroAcesso(tipo) {
  window.tipoEscolhido = tipo;

  const areaLogin =
    document.getElementById("areaLogin");

  const areaCadastro =
    document.getElementById("areaCadastro");

  const container =
    document.querySelector(
      ".login-container"
    );

  // ESCONDE LOGIN
  if (areaLogin) {
    areaLogin.style.display = "none";
  }

  // MOSTRA CADASTRO
  if (areaCadastro) {
    areaCadastro.style.display = "block";
  }

  // AUMENTA CARD
  if (container) {
    container.classList.add(
      "cadastro-ativo"
    );
  }

  atualizarCamposPrimeiroAcesso(tipo);
}

function atualizarCamposPrimeiroAcesso(tipo) {
  const ehProfissional = tipo === "profissional";

  definirDisplayPorClasse(
    "campo-profissional",
    ehProfissional ? "block" : "none"
  );

  definirDisplayPorClasse(
    "campo-paciente",
    ehProfissional ? "none" : "block"
  );

  definirTexto(
    "tituloCadastro",
    ehProfissional
      ? "Primeiro acesso do profissional"
      : "Primeiro acesso do paciente"
  );
}

// =============================
// VOLTAR LOGIN
// =============================
function voltarLogin() {

  const areaLogin =
    document.getElementById("areaLogin");

  const areaCadastro =
    document.getElementById("areaCadastro");

  const container =
    document.querySelector(
      ".login-container"
    );

  // MOSTRA LOGIN
  if (areaLogin) {
    areaLogin.style.display = "block";
  }

  // ESCONDE CADASTRO
  if (areaCadastro) {
    areaCadastro.style.display = "none";
  }

  // TAMANHO NORMAL
  if (container) {
    container.classList.remove(
      "cadastro-ativo"
    );
  }

  atualizarCamposPrimeiroAcesso(
    getTipoEscolhido()
  );
}

// =============================
// CADASTRO
// =============================
async function cadastrar() {
  const tipo = getTipoEscolhido() || "paciente";

  const usuario = {
    nome: obterValor("nomeCadastro"),
    email: obterValor("emailCadastro"),
    cpf: limparCPF(obterValor("cpfCadastro")),
    telefone: obterValor("telefoneCadastro"),
    password: obterValor("senhaCadastro"),
    tipo: tipo,
    cargo: "",
    registroProfissional: "",
    unidade: "",
    fotoPerfil: ""
  };

  const fotoInput = document.getElementById("fotoPerfil");
  if (fotoInput?.files?.length > 0) {
    const arquivoFoto = fotoInput.files[0];
    if (!arquivoFoto.type.startsWith("image/")) {
      mostrarMensagem("Selecione uma imagem válida", "erro");
      return;
    }
    usuario.fotoPerfil = await lerArquivoComoDataURL(arquivoFoto);
  }

  if (
    !usuario.nome ||
    !usuario.cpf ||
    !usuario.password ||
    !usuario.email
  ) {
    mostrarMensagem(
      "Preencha nome, e-mail, CPF e senha",
      "erro"
    );
    return;
  }

  if (!cpfValido(usuario.cpf)) {
    mostrarMensagem("CPF inválido", "erro");
    return;
  }

  const existeCpf = await window.firebaseService.getUserDocByCpf(usuario.cpf);

  if (existeCpf) {
    mostrarMensagem(
      "CPF já cadastrado",
      "erro"
    );
    return;
  }

  if (tipo === "paciente") {
    usuario.sexo = obterValor("sexoCadastro");
    usuario.estadoCivil = obterValor("estadoCivilCadastro");
    usuario.data = obterValor("dataCadastro");
    usuario.estado = obterValor("estadoCadastro");
    usuario.cidade = obterValor("cidadeCadastro");
    usuario.bairro = obterValor("bairroCadastro");
    usuario.rua = obterValor("ruaCadastro");
    usuario.numero = obterValor("numeroCadastro");
  }

  if (tipo === "profissional") {
    usuario.cargo = obterValor("funcaoProfissionalCadastro");
    usuario.registroProfissional = obterValor("registroProfissionalCadastro");
    usuario.unidade = obterValor("unidadeCadastro");

    if (!usuario.cargo || !usuario.registroProfissional) {
      mostrarMensagem(
        "Preencha funcao e registro",
        "erro"
      );
      return;
    }
  }

  try {
    const perfil = await window.firebaseService.signUp(usuario);
    appState.usuarios.push(perfil);
    mostrarMensagem(
      "Cadastro realizado com sucesso!",
      "sucesso"
    );

    setTimeout(() => {
      voltarLogin();
    }, 1000);
  } catch (error) {
    console.error(error);
    const mensagemErro = String(error?.message || "");
    const detalhe = mensagemErro.includes("permissions")
      ? "Verifique as regras do Firestore no console do Firebase."
      : "Verifique os dados e tente novamente.";

    mostrarMensagem(
      `Erro no cadastro. ${detalhe}`,
      "erro"
    );
  }
}

// =============================
// RECUPERAR SENHA
// =============================
async function recuperarSenha() {
  const email = obterValor("emailRecuperar");

  if (!email) {
    mostrarMensagem(
      "Preencha o e-mail para recuperar a senha",
      "erro"
    );
    return;
  }

  try {
    await window.firebaseService.sendPasswordReset(email);
    mostrarMensagem(
      "Enviamos um link de recuperação para o seu e-mail.",
      "sucesso"
    );
  } catch (error) {
    console.error(error);
    mostrarMensagem(
      "Não foi possível enviar o e-mail de recuperação.",
      "erro"
    );
  }
}
// SALVAR REGISTRO
// =============================
async function salvarRegistro() {

  const sistolica = Number(obterValor("pressao_sistolica"));

  const diastolica =
    Number(obterValor("pressao_diastolica"));

  const glicemia =
    Number(obterValor("glicemia"));

  const medicamentos =
    obterValor("medicamentos");

  const sintomas =
    obterValor("sintomas");

  if (
    !sistolica ||
    !diastolica ||
    !glicemia
  ) {

    mostrarMensagem(
      "Preencha todos os campos",
      "erro"
    );

    return;
  }

  if (sistolica > 300 || diastolica > 200) {

    mostrarMensagem(
      "Valor de pressão inválido",
      "erro"
    );

    return;
  }

  if (glicemia > 600) {

    mostrarMensagem(
      "Valor de glicemia inválido",
      "erro"
    );

    return;
  }

  const usuario = appState.currentProfile || await window.firebaseService.getUserDocByUid(window.firebaseService.user?.uid);

  if (!usuario) {
    mostrarMensagem(
      "Usuário não identificado",
      "erro"
    );

    return;
  }

  const registro = {
    data: new Date().toLocaleString("pt-BR"),

    pressao: `${sistolica}/${diastolica}`,

    sistolica,
    diastolica,
    glicemia,

    medicamentos,
    sintomas
  };

  const chave = "historico_" + usuario.cpf;
  let historico = await carregarHistorico(usuario.cpf);

  if (editandoIndex !== null) {
    const registroExistente = historico[editandoIndex] || {};
    registro.__docId = registroExistente.__docId;

    if (registro.__docId) {
      await window.firebaseService.updateHistorico(registro.__docId, registro);
    }

    historico[editandoIndex] = registro;
    editandoIndex = null;
  } else {
    const novoRegistro = await window.firebaseService.addHistorico(usuario.uid, registro);
    historico.push(novoRegistro);
  }

  appState.historicos[usuario.cpf] = historico;
  limparCampos();

  mostrarMensagem(
    "Registro salvo com sucesso!",
    "sucesso"
  );

  await atualizarCards();
  await mostrarHistorico();
  desenharGrafico();
  atualizarStatusPaciente(
    sistolica,
    diastolica,
    glicemia
  );
}

// =============================
// LIMPAR CAMPOS
// =============================
function limparCampos() {

  [
    "pressao_sistolica",
    "pressao_diastolica",
    "glicemia",
    "medicamentos",
    "sintomas"
  ]

  .forEach(id => {

    const el =
      document.getElementById(id);

    if (el) {
      el.value = "";
    }
  });
}

// =============================
// EDITAR REGISTRO
// =============================
async function editarRegistro(index) {
  const usuario = appState.currentProfile || await window.firebaseService.getUserDocByUid(window.firebaseService.user?.uid);
  if (!usuario) return;

  const historico = await carregarHistorico(usuario.cpf);
  const item = historico[index];
  if (!item) return;

  document.getElementById("pressao_sistolica").value = item.sistolica;
  document.getElementById("pressao_diastolica").value = item.diastolica;
  document.getElementById("glicemia").value = item.glicemia;
  document.getElementById("medicamentos").value = item.medicamentos;
  document.getElementById("sintomas").value = item.sintomas;

  editandoIndex = index;

  mostrarMensagem("Editando registro", "aviso");
}

// =============================
// CANCELAR EDIÃ‡ÃƒO
// =============================
function cancelarEdicao() {

  editandoIndex = null;

  limparCampos();

  mostrarMensagem(
    "EdiÃ§Ã£o cancelada",
    "aviso"
  );
}

// =============================
// HISTÃ“RICO
// =============================
async function mostrarHistorico() {
  const historicoDiv = document.getElementById("historico");
  if (!historicoDiv) return;

  const usuario = appState.currentProfile || await window.firebaseService.getUserDocByUid(window.firebaseService.user?.uid);
  if (!usuario) {
    historicoDiv.innerHTML = "<p>Usuário não identificado.</p>";
    return;
  }

  const historico = await carregarHistorico(usuario.cpf);
  historicoDiv.innerHTML = "";

  if (historico.length === 0) {
    historicoDiv.innerHTML = "<p>Nenhum registro encontrado.</p>";
    return;
  }

  historico
    .slice()
    .reverse()
    .forEach((item, index) => {

      // CARD
      const card =
        document.createElement("div");

      card.className =
        "card p-3 mb-2";

      // DATA
      const data =
        document.createElement("strong");

      data.textContent = item.data;

      // PRESSÃƒO
      const pressao =
        document.createElement("p");

      pressao.textContent =
        "Pressão: " + item.pressao + " mmHg";

      // GLICEMIA
      const glicemia =
        document.createElement("p");

      glicemia.textContent =
        "Glicemia: " +
        item.glicemia +
        " mg/dL";

      // MEDICAMENTOS
      const medicamentos =
        document.createElement("p");

      medicamentos.textContent =
        "Medicamentos: " +
        (item.medicamentos || "");

      // SINTOMAS
      const sintomas =
        document.createElement("p");

      sintomas.textContent =
        "Sintomas: " +
        (item.sintomas || "");

      // BOTÃƒO
      const botao =
        document.createElement("button");

      botao.className =
        "btn btn-warning btn-sm";

      botao.textContent =
        "Editar";

      botao.onclick = () => {
        editarRegistro(
          historico.length - 1 - index
        );
      };

      // APPEND
      card.appendChild(data);
      card.appendChild(document.createElement("br"));

      card.appendChild(pressao);
      card.appendChild(glicemia);
      card.appendChild(medicamentos);
      card.appendChild(sintomas);

      card.appendChild(botao);
      // BOTÃƒO EXCLUIR
const botaoExcluir =
  document.createElement("button");

botaoExcluir.className =
  "btn btn-danger btn-sm ms-2";

botaoExcluir.textContent =
  "Excluir";

botaoExcluir.onclick = () => {

  excluirRegistro(
    historico.length - 1 - index
  );

};

// ÃREA DOS BOTÃ•ES
const areaBotoes =
  document.createElement("div");

areaBotoes.style.marginTop = "10px";

areaBotoes.appendChild(botao);

areaBotoes.appendChild(botaoExcluir);

card.appendChild(areaBotoes);

      historicoDiv.appendChild(card);

    });
}

function atualizarStatusPaciente(
  sistolica,
  diastolica,
  glicemia
) {

  const box =
    document.getElementById("boxAlerta");

  const texto =
    document.getElementById("cardAlerta");

  if (!box || !texto) return;

  // limpa classes
  box.classList.remove(
    "alerta-normal",
    "alerta-atencao",
    "alerta-critico"
  );

  // CRÍTICO
  if (
    sistolica >= 180 ||
    diastolica >= 120 ||
    glicemia >= 300
  ) {

    box.classList.add("alerta-critico");

    texto.innerText =
      " Estado crítico";

    return;
  }

  // ATENÇÃO
  if (
    sistolica >= 140 ||
    diastolica >= 90 ||
    glicemia >= 180
  ) {

    box.classList.add("alerta-atencao");

    texto.innerText =
      "Atenção necessária";

    return;
  }

  // NORMAL
  box.classList.add("alerta-normal");

  texto.innerText =
    "Estável";
}

function obterUltimoRegistroPaciente(cpf) {
  const historico = appState.historicos[cpf] || [];

  if (historico.length === 0) {
    return null;
  }

  return historico[historico.length - 1];
}

function obterNivelGravidadePaciente(paciente) {
  const ultimo =
    obterUltimoRegistroPaciente(paciente.cpf);

  if (!ultimo) {
    return 0;
  }

  if (
    ultimo.sistolica >= 180 ||
    ultimo.diastolica >= 120 ||
    ultimo.glicemia >= 300
  ) {
    return 3;
  }

  if (
    ultimo.sistolica >= 140 ||
    ultimo.diastolica >= 90 ||
    ultimo.glicemia >= 180
  ) {
    return 2;
  }

  return 1;
}

function obterStatusPaciente(paciente) {
  const nivel =
    obterNivelGravidadePaciente(paciente);

  if (nivel === 3) {
    return {
      texto: "Estado crítico",
      cor: "#dc3545"
    };
  }

  if (nivel === 2) {
    return {
      texto: "Atenção necessária",
      cor: "#b58100"
    };
  }

  if (nivel === 1) {
    return {
      texto: "Estável",
      cor: "#198754"
    };
  }

  return {
    texto: "Sem acompanhamento",
    cor: "#6c757d"
  };
}

function obterTempoRegistro(data = "") {
  const texto =
    String(data);

  const partes =
    texto.match(
      /^(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2})?:?(\d{2})?:?(\d{2})?/
    );

  if (partes) {
    const dia =
      Number(partes[1]);

    const mes =
      Number(partes[2]) - 1;

    const ano =
      Number(partes[3]);

    const hora =
      Number(partes[4] || 0);

    const minuto =
      Number(partes[5] || 0);

    const segundo =
      Number(partes[6] || 0);

    return new Date(
      ano,
      mes,
      dia,
      hora,
      minuto,
      segundo
    ).getTime();
  }

  const tempo =
    new Date(texto).getTime();

  return Number.isNaN(tempo)
    ? 0
    : tempo;
}

function ordenarPacientesPorGravidade(pacientes) {
  pacientes.sort((a, b) => {
    const diferencaGravidade =
      obterNivelGravidadePaciente(b) -
      obterNivelGravidadePaciente(a);

    if (diferencaGravidade !== 0) {
      return diferencaGravidade;
    }

    const ultimoA =
      obterUltimoRegistroPaciente(a.cpf);

    const ultimoB =
      obterUltimoRegistroPaciente(b.cpf);

    const dataA =
      ultimoA ? obterTempoRegistro(ultimoA.data) : 0;

    const dataB =
      ultimoB ? obterTempoRegistro(ultimoB.data) : 0;

    return dataB - dataA;
  });
}

// =============================
// EXCLUIR REGISTRO
// =============================
async function excluirRegistro(index) {

  const confirmar = confirm(
    "Deseja excluir este registro?"
  );

  if (!confirmar) return;

  const usuario = appState.currentProfile || await window.firebaseService.getUserDocByUid(window.firebaseService.user?.uid);
  if (!usuario) return;

  let historico = await carregarHistorico(usuario.cpf);
  const item = historico[index];
  if (!item || !item.__docId) return;

  await window.firebaseService.deleteHistoricoById(item.__docId);
  historico.splice(index, 1);
  appState.historicos[usuario.cpf] = historico;

  mostrarMensagem(
    "Registro excluído!",
    "aviso"
  );

  await mostrarHistorico();
  await atualizarCards();
  desenharGrafico();
}

// =============================
// INICIAR DASHBOARD
// =============================
window.onload = async function(){
  if (window.firebaseService?.authReady) {
    await window.firebaseService.authReady;
    appState.currentUser = window.firebaseService.user;
    appState.currentProfile = window.firebaseService.profile;
  }

  if (document.getElementById("inicio")) {
    mostrarSecao("inicio");
  }

  if (document.getElementById("historico") && typeof mostrarHistorico === "function") {
    mostrarHistorico();
  }

  if (document.getElementById("consultas") && typeof mostrarConsultas === "function") {
    mostrarConsultas();
  }

  if (
    (document.getElementById("cardPressao") ||
      document.getElementById("cardGlicemia") ||
      document.getElementById("cardData") ||
      document.getElementById("boxAlerta")) &&
    typeof atualizarCards === "function"
  ) {
    atualizarCards();
  }

  if (document.getElementById("grafico") && typeof desenharGrafico === "function") {
    desenharGrafico();
  }

  if (document.getElementById("listaPacientes") && typeof mostrarPacientes === "function") {
    mostrarPacientes();
  }

  if (document.getElementById("meuPerfilConteudo") && typeof renderizarMeuPerfil === "function") {
    renderizarMeuPerfil();
  }
};

// =============================
// LISTAR PACIENTES
// =============================
async function mostrarPacientes() {
  const div = document.getElementById("listaPacientes");
  if (!div) return;

  const usuarios = await carregarUsuarios();
  const pacientes = usuarios.filter(u => String(u.tipo).toLowerCase().trim() === "paciente");

  for (const paciente of pacientes) {
    await carregarHistorico(paciente.cpf);
  }

  ordenarPacientesPorGravidade(pacientes);

  div.innerHTML = "";

  if (pacientes.length === 0) {

    div.innerHTML = `
      <p>
        Nenhum paciente encontrado.
      </p>
    `;

    return;
  }

  pacientes.forEach(paciente => {

    const ultimo =
      obterUltimoRegistroPaciente(
        paciente.cpf
      );

   // =========================
   // STATUS
   // =========================
    const statusPaciente =
      obterStatusPaciente(paciente);

    const status =
      statusPaciente.texto;

    const cor =
      statusPaciente.cor;

    // =========================
    // CARD
    // =========================
     const card =
  document.createElement("div");

card.className =
  "card p-3 mb-3 border-0";

const nivelGravidade =
  obterNivelGravidadePaciente(paciente);

if (nivelGravidade === 3) {

  card.style.background =
    "#ffe5e5";

  card.style.borderLeft =
    "6px solid #dc3545";

}

else if (nivelGravidade === 2) {

  card.style.background =
    "#fff8e1";

  card.style.borderLeft =
    "6px solid #ffc107";

}

else if (nivelGravidade === 1) {

  card.style.background =
    "#e9f7ef";

  card.style.borderLeft =
    "6px solid #198754";

}

else {

  card.style.background =
    "#f1f1f1";

  card.style.borderLeft =
    "6px solid #6c757d";

}

    card.innerHTML = `
      <h5>
        ${paciente.nome}
      </h5>

      <p>
        CPF:
        ${formatarCPF(
          paciente.cpf
        )}
      </p>

      <p>
        Última pressão:
        ${ultimo
          ? ultimo.pressao + " mmHg"
          : "Sem registros"}
      </p>

      <p>
        última glicemia:
        ${ultimo
          ? ultimo.glicemia + " mg/dL"
          : "Sem registros"}
      </p>

      <p style="
        font-weight:bold;
        color:${cor};
      ">
        ${status}
      </p>
    `;

    // =========================
    // CLICK
    // =========================
    card.style.cursor = "pointer";

    card.onclick = () => {
      abrirDetalhesPaciente(
        paciente.cpf
      );
    };

   const btnExcluir =
  document.createElement("button");

btnExcluir.className =
  "btn btn-danger btn-sm mt-2";

btnExcluir.innerText =
  "Excluir paciente";

if (!usuarioEhAdmin()) {
  btnExcluir.style.display = "none";
}

btnExcluir.onclick = (e) => {

  e.stopPropagation();

  if (!usuarioEhAdmin()) {
    mostrarMensagem("Apenas profissionais podem excluir pacientes", "erro");
    return;
  }

  excluirPaciente(
    paciente.cpf
  );

};

card.appendChild(btnExcluir);

// =========================
// BOTÃƒO EDITAR
// =========================
const btnEditar =
  document.createElement("button");

btnEditar.className =
  "btn btn-primary btn-sm mt-2 ms-2";

btnEditar.innerText =
  "Editar paciente";

btnEditar.onclick = (e) => {

  e.stopPropagation();

  editarPaciente(
    paciente.cpf
  );
 
};

card.appendChild(btnEditar);


// ADICIONA CARD
div.appendChild(card);
});
}

// =============================
// ATUALIZAR CARDS
// =============================
async function atualizarCards() {
  const usuario = appState.currentProfile || await window.firebaseService.getUserDocByUid(window.firebaseService.user?.uid);
  if (!usuario) return;

  const historico = await carregarHistorico(usuario.cpf);

  if (historico.length === 0) {

    definirTexto(
      "cardPressao",
      ""
    );

    definirTexto(
      "cardGlicemia",
      ""
    );

    definirTexto(
      "cardData",
      ""
    );

    return;
  }

  const ultimo =
    historico[historico.length - 1];

  definirTexto(
    "cardPressao",
    ultimo.pressao + " mmHg"
  );

  definirTexto(
    "cardGlicemia",
    ultimo.glicemia + " mg/dL"
  );

  definirTexto(
    "cardData",
    ultimo.data
  );

  atualizarStatusPaciente(
    ultimo.sistolica,
    ultimo.diastolica,
    ultimo.glicemia
  );
}

// =============================
// GRÃFICO
// =============================
function temaEscuroAtivo() {
  return appState.temaPainel === "escuro";
}

function aplicarTemaPainel() {
  const botoes = [
    document.getElementById("btnTemaGrafico"),
    document.getElementById("btnAlternarTema")
  ].filter(Boolean);

  const escuro = temaEscuroAtivo();

  document.body.classList.toggle(
    "tema-escuro",
    escuro
  );

  botoes.forEach(botao => {
    botao.innerText = escuro ? "☀" : "☾";
    botao.setAttribute(
      "aria-label",
      escuro ? "Ativar modo claro" : "Ativar modo escuro"
    );
    botao.setAttribute(
      "title",
      escuro ? "Ativar modo claro" : "Ativar modo escuro"
    );
  });
}

function alternarTemaGrafico() {
  const proximoTema = temaEscuroAtivo() ? "claro" : "escuro";
  appState.temaPainel = proximoTema;
  aplicarTemaPainel();
  desenharGrafico();
}

function alternarTema() {
  alternarTemaGrafico();
}

function dataCurtaGrafico(data = "") {
  return String(data).split(",")[0];
}

function desenharGrafico() {

  const canvas =
    document.getElementById("grafico");

  if (!canvas) return;

  const ctx =
    canvas.getContext("2d");

  const usuario = obterUsuarioLogado();
  const historico = usuario ? (appState.historicos[usuario.cpf] || []) : [];

  const wrapper =
    canvas.parentElement;

  const largura =
    Math.max(
      wrapper ? wrapper.clientWidth - 24 : 720,
      320
    );

  const altura =
    Math.max(
      wrapper ? wrapper.clientHeight - 24 : 320,
      260
    );

  const dpr =
    window.devicePixelRatio || 1;

  canvas.width =
    Math.floor(largura * dpr);

  canvas.height =
    Math.floor(altura * dpr);

  canvas.style.width =
    largura + "px";

  canvas.style.height =
    altura + "px";

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  ctx.clearRect(0, 0, largura, altura);

  const escuro =
    temaEscuroAtivo();

  const cores = {
    fundo: escuro ? "#111827" : "#ffffff",
    grade: escuro ? "#334155" : "#e5e7eb",
    texto: escuro ? "#e5e7eb" : "#475467",
    titulo: escuro ? "#f9fafb" : "#111827",
    pressao: "#22c55e",
    glicemia: "#3b82f6"
  };

  ctx.fillStyle = cores.fundo;
  ctx.fillRect(0, 0, largura, altura);

  if (historico.length === 0) {
    ctx.fillStyle = cores.texto;
    ctx.font = "600 15px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "Nenhum dado para exibir",
      largura / 2,
      altura / 2
    );
    return;
  }

  const series = [
    {
      nome: "Pressão",
      unidade: "mmHg",
      cor: cores.pressao,
      valores: historico.map(item => item.sistolica)
    }
  ];

  const valores =
    series.flatMap(item => item.valores);

  const maximo =
    Math.max(200, ...valores);

  const escalaMaxima =
    Math.ceil(maximo / 50) * 50;

  const margem = {
    topo: 54,
    direita: 24,
    baixo: 48,
    esquerda: 58
  };

  const areaLargura =
    largura - margem.esquerda - margem.direita;

  const areaAltura =
    altura - margem.topo - margem.baixo;

  const eixoX =
    margem.esquerda;

  const eixoY =
    margem.topo + areaAltura;

  function pontoX(index) {
    if (historico.length === 1) {
      return margem.esquerda + areaLargura / 2;
    }

    return margem.esquerda +
      (areaLargura / (historico.length - 1)) *
      index;
  }

  function pontoY(valor) {
    return eixoY -
      (valor / escalaMaxima) *
      areaAltura;
  }

  ctx.strokeStyle = cores.grade;
  ctx.lineWidth = 1;
  ctx.font = "12px Segoe UI, Arial";
  ctx.fillStyle = cores.texto;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 4; i++) {
    const valor =
      (escalaMaxima / 4) * i;

    const y =
      eixoY - (areaAltura / 4) * i;

    ctx.beginPath();
    ctx.moveTo(eixoX, y);
    ctx.lineTo(eixoX + areaLargura, y);
    ctx.stroke();

    ctx.fillText(
      String(valor),
      margem.esquerda - 10,
      y
    );
  }

  ctx.strokeStyle = cores.texto;
  ctx.beginPath();
  ctx.moveTo(eixoX, margem.topo);
  ctx.lineTo(eixoX, eixoY);
  ctx.lineTo(eixoX + areaLargura, eixoY);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  historico.forEach((item, index) => {
    const deveMostrar =
      historico.length <= 6 ||
      index === 0 ||
      index === historico.length - 1;

    if (!deveMostrar) return;

    ctx.fillText(
      dataCurtaGrafico(item.data),
      pontoX(index),
      eixoY + 14
    );
  });

  let legendaX =
    margem.esquerda;

  series.forEach(serie => {
    ctx.fillStyle = serie.cor;
    ctx.beginPath();
    ctx.arc(legendaX + 6, 20, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cores.titulo;
    ctx.font = "700 13px Segoe UI, Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${serie.nome} (${serie.unidade})`,
      legendaX + 18,
      20
    );

    legendaX +=
      ctx.measureText(`${serie.nome} (${serie.unidade})`).width + 48;
  });

  series.forEach(serie => {
    ctx.strokeStyle = serie.cor;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();

    serie.valores.forEach((valor, index) => {
      const x = pontoX(index);
      const y = pontoY(valor);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    serie.valores.forEach((valor, index) => {
      const x = pontoX(index);
      const y = pontoY(valor);

      ctx.fillStyle = cores.fundo;
      ctx.strokeStyle = serie.cor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  });
}
// =============================
// TOTAL PACIENTES EM ALERTA
// =============================
async function atualizarTotalAlertas() {
  const elemento = document.getElementById("totalAlertas");
  if (!elemento) return;

  const usuarios = await carregarUsuarios();
  const pacientes = usuarios.filter(u => String(u.tipo).toLowerCase().trim() === "paciente");

  let total = 0;

  for (const paciente of pacientes) {
    const historico = await carregarHistorico(paciente.cpf);

    if (historico.length === 0) {
      continue;
    }

    const ultimo = historico[historico.length - 1];
    const alertaPressao = ultimo.sistolica >= 140 || ultimo.diastolica >= 90;
    const alertaGlicemia = ultimo.glicemia >= 180;

    if (alertaPressao || alertaGlicemia) {
      total++;
    }
  }

  elemento.innerText = total;

}

// =============================
// TOTAL DE PACIENTES
// =============================
async function atualizarTotalPacientes() {
  const elemento = document.getElementById("totalPacientes");
  if (!elemento) return;

  const usuarios = await carregarUsuarios();
  const pacientes = usuarios.filter(u => String(u.tipo).toLowerCase().trim() === "paciente");
  elemento.innerText = pacientes.length;
}

// =============================
// ABRIR DETALHES DO PACIENTE
// =============================
async function abrirDetalhesPaciente(cpf) {
  const box = document.getElementById("detalhesPaciente");
  const conteudo = document.getElementById("conteudoDetalhesPaciente");

  if (!box || !conteudo) return;

  const usuarios = await carregarUsuarios();
  const paciente = usuarios.find(u => u.cpf === cpf);
  if (!paciente) return;

  const historico = await carregarHistorico(cpf);

  let html = `
    <h4 class="text-primary mb-3">
      ${paciente.nome}
    </h4>

    <p>
      <strong>CPF:</strong>
      ${formatarCPF(paciente.cpf)}
    </p>

    <hr>
  `;

  if (historico.length === 0) {

    html += `
      <p>
        Nenhum registro encontrado.
      </p>
    `;

  } else {

    historico
      .slice()
      .reverse()
      .forEach(item => {

        html += `
          <div class="card p-3 mb-3">

            <strong>
              ${item.data}
            </strong>

            <p class="mb-1">
              Pressão:
              ${item.pressao} mmHg
            </p>

            <p class="mb-1">
              Glicemia:
              ${item.glicemia} mg/dL
            </p>

            <p class="mb-1">
              Medicamentos:
              ${item.medicamentos || ""}
            </p>

            <p class="mb-0">
              Sintomas:
              ${item.sintomas || ""}
            </p>

          </div>
        `;

      });

  }

  conteudo.innerHTML = html;

  box.style.display = "block";

  box.scrollIntoView({
    behavior: "smooth"
  });

}
// =============================
// FILTRAR PACIENTES
// =============================
function filtrarPacientesProfissional() {

  const busca =
    document.getElementById(
      "buscaPaciente"
    ).value.toLowerCase();

  const cards =
    document.querySelectorAll(
      "#listaPacientes .card"
    );

  cards.forEach(card => {

    const texto =
      card.innerText.toLowerCase();

    if (texto.includes(busca)) {

      card.style.display =
        "block";

    } else {

      card.style.display =
        "none";
    }

  });

}

// =============================
// MOSTRAR ALERTAS CRÃTICOS
// =============================
async function mostrarAlertasCriticos() {
  const div = document.getElementById("alertas");
  if (!div) return;

  const usuarios = await carregarUsuarios();
  const pacientes = usuarios.filter(u => String(u.tipo).toLowerCase().trim() === "paciente");

  div.innerHTML = "";

  let encontrou = false;

  for (const paciente of pacientes) {
    const historico = await carregarHistorico(paciente.cpf);

    if (historico.length === 0) {
      continue;
    }

    const ultimo = historico[historico.length - 1];

    const critico =
      ultimo.sistolica >= 180 ||
      ultimo.diastolica >= 120 ||
      ultimo.glicemia >= 300;

    if (!critico) continue;

    encontrou = true;

    const card =
      document.createElement("div");

    card.className =
      "card border-danger p-3 mb-3";

    card.innerHTML = `

      <h5 class="text-danger">
         ${paciente.nome}
      </h5>

      <p class="mb-1">
        Pressão:
        ${ultimo.pressao} mmHg
      </p>

      <p class="mb-1">
        Glicemia:
        ${ultimo.glicemia} mg/dL
      </p>
      
      <p>
    📄 Registros:
    ${historico.length}
    </p> 
     
    <p>
    🕒 Último registro:
    ${ultimo
    ? ultimo.data
    : "Nunca"}
    </p>


    `;
     
    card.style.cursor = "pointer";

    card.onclick = () => {
  abrirDetalhesPaciente(
    paciente.cpf
  );
};

    div.appendChild(card);
  }

  if (!encontrou) {

    div.innerHTML = `
      <p class="text-muted mb-0">
        Nenhum alerta crítico no momento.
      </p>
    `;
  }

}

// =============================
// EXCLUIR PACIENTE
// =============================
async function excluirPaciente(cpf) {

  const confirmar = confirm(
    "Deseja excluir este paciente?"
  );

  if (!confirmar) return;

  const usuario = await window.firebaseService.getUserDocByCpf(cpf);
  if (usuario && usuario.uid) {
    await window.firebaseService.deleteHistoricosByUsuarioId(usuario.uid);
    await window.firebaseService.deleteConsultasByUsuarioId(usuario.uid);
    await window.firebaseService.deleteUser(usuario.uid);
  }

  const usuarios = await carregarUsuarios();
  const restante = usuarios.filter(u => u.cpf !== cpf);
  appState.usuarios = restante;

  mostrarMensagem(
    "Paciente excluído!",
    "aviso"
  );

  await mostrarPacientes();
  await atualizarTotalPacientes();
  await atualizarTotalAlertas();
  await mostrarAlertasCriticos();
}

// =============================
// EDITAR PACIENTE
// =============================
async function editarPaciente(cpf) {
  const usuarios = await carregarUsuarios();
  const paciente = usuarios.find(u => u.cpf === cpf);
  if (!paciente) return;

  const novoNome = prompt(
    "Novo nome:",
    paciente.nome
  );

  if (!novoNome) return;

  const novoTelefone = prompt(
    "Novo telefone:",
    paciente.telefone || ""
  );

  paciente.nome = novoNome;
  paciente.telefone = novoTelefone;

  if (paciente.uid) {
    await window.firebaseService.updateUserDoc(paciente.uid, {
      nome: paciente.nome,
      telefone: paciente.telefone
    });
  }

  appState.usuarios = usuarios;

  mostrarMensagem(
    "Paciente atualizado!",
    "sucesso"
  );

  mostrarPacientes();
  abrirDetalhesPaciente(cpf);
}

// =============================
// AGENDAR CONSULTA
// =============================
async function agendarConsulta() {
  const data = document.getElementById("dataConsulta").value;
  const hora = document.getElementById("horaConsulta").value;

  if (!data || !hora) {
    mostrarMensagem(
      "Escolha data e horário",
      "erro"
    );
    return;
  }

  const usuario = appState.currentProfile || await window.firebaseService.getUserDocByUid(window.firebaseService.user?.uid);
  if (!usuario) {
    mostrarMensagem("Usuário não identificado", "erro");
    return;
  }

  const consulta = {
    pacienteId: usuario.uid,
    pacienteNome: usuario.nome,
    profissionalId: "",
    data,
    hora,
    status: "Pendente"
  };

  const novaConsulta = await window.firebaseService.addConsulta(consulta);
  appState.consultas.push(novaConsulta);

  mostrarMensagem(
    "Consulta agendada!",
    "sucesso"
  );

  await mostrarConsultas();
}

function formatarDataConsulta(data) {
  if (!data) return "";

  const partes = data.split("-");

  if (partes.length !== 3) {
    return data;
  }

  const [ano, mes, dia] = partes;

  return `${dia}/${mes}/${ano}`;
}

function montarStatusConsulta(status) {
  const cores = {
    Pendente: "#ffc107",
    Confirmada: "#198754",
    Cancelada: "#dc3545"
  };

  const cor = cores[status] || "#6c757d";

  return `
    <span style="
      display:inline-flex;
      align-items:center;
      gap:7px;
      font-weight:bold;
      color:${cor};
    ">
      <span style="
        width:10px;
        height:10px;
        border-radius:50%;
        background:${cor};
        display:inline-block;
      "></span>
      ${status}
    </span>
  `;
}

// =============================
// MOSTRAR CONSULTAS PACIENTE
// =============================
async function mostrarConsultas() {
  const div = document.getElementById("listaConsultas");
  if (!div) return;

  const usuario = appState.currentProfile || await window.firebaseService.getUserDocByUid(window.firebaseService.user?.uid);
  if (!usuario) return;

  const consultas = await carregarConsultas();
  const minhasConsultas = consultas.filter(c => c.pacienteId === usuario.uid);

  div.innerHTML = "";

  if (minhasConsultas.length === 0) {

    div.innerHTML = `
      <p>
        Nenhuma consulta agendada.
      </p>
    `;

    return;
  }

  minhasConsultas.forEach(c => {

    const card =
      document.createElement("div");

    card.className =
      "card p-3 mb-2";

    card.innerHTML = `
      <strong>
         ${formatarDataConsulta(c.data)}
      </strong>

      <p class="mb-0">
         ${c.hora}
      </p>

      <p class="mb-0">
        Status:
        ${montarStatusConsulta(c.status)}
      </p>
    `;

    div.appendChild(card);

  });

}

// =============================
// CONSULTAS PROFISSIONAL
// =============================
async function mostrarConsultasProfissional() {
  const div = document.getElementById("listaConsultasProfissional");
  if (!div) return;

  const usuario = appState.currentProfile || await window.firebaseService.getUserDocByUid(window.firebaseService.user?.uid);
  if (!usuario) return;

  const consultas = await carregarConsultas();
  div.innerHTML = "";

  if (consultas.length === 0) {

    div.innerHTML = `
      <p class="text-muted">
        Nenhuma consulta agendada.
      </p>
    `;

    return;
  }

  consultas.forEach((c, index) => {

    const card =
      document.createElement("div");

    card.className =
      "card p-3 mb-3";

    card.innerHTML = `

      <h5>${c.pacienteNome}</h5>

      <p> ${formatarDataConsulta(c.data)}</p>

      <p> ${c.hora}</p>

      <p>
        ${montarStatusConsulta(c.status)}
      </p>

    `;

    // BOTÃƒO CONFIRMAR
    const btnConfirmar =
      document.createElement("button");

    btnConfirmar.className =
      "btn btn-success btn-sm me-2";

    btnConfirmar.innerText =
      "Confirmar";

    btnConfirmar.onclick = async () => {
      const consulta = consultas[index];
      if (!consulta || !consulta.__docId) return;

      await window.firebaseService.updateConsulta(consulta.__docId, {
        status: "Confirmada",
        profissionalId: usuario.uid,
        profissionalNome: usuario.nome
      });

      await carregarConsultas();
      await mostrarConsultasProfissional();
    };

    // BOTÃƒO CANCELAR
    const btnCancelar =
      document.createElement("button");

    btnCancelar.className =
      "btn btn-danger btn-sm";

    btnCancelar.innerText =
      "Cancelar";

    btnCancelar.onclick = async () => {
      const consulta = consultas[index];
      if (!consulta || !consulta.__docId) return;

      await window.firebaseService.updateConsulta(consulta.__docId, {
        status: "Cancelada"
      });

      await carregarConsultas();
      await mostrarConsultasProfissional();
    };

    const areaBotoes =
      document.createElement("div");

    areaBotoes.className =
      "mt-2";

    areaBotoes.appendChild(
      btnConfirmar
    );

    areaBotoes.appendChild(
      btnCancelar
    );

    card.appendChild(
      areaBotoes
    );

    div.appendChild(card);

  });

}

 function irInicio(){
  mostrarSecao("inicio");
}

function irRegistrar(){
  mostrarSecao("registrar");
}

function irHistorico(){
  mostrarSecao("historicoSec");
}

function irEvolucao(){
  mostrarSecao("evolucaoSec");
}

function irAgendamento(){
  mostrarSecao("agendamentoSec");
}

function irMeuPerfil(){
  mostrarSecao("meuPerfilSec");
  renderizarMeuPerfil();
}

function mostrarSecao(id){

  const secoes = [
    "inicio",
    "registrar",
    "historicoSec",
    "evolucaoSec",
    "agendamentoSec",
    "meuPerfilSec",
    "pacientesSec",
    "detalhesPaciente",
    "alertasSec",
    "registrosSec",
    "consultasProfissionalSec"
  ];

  secoes.forEach(sec => {

    const el = document.getElementById(sec);

    if(el){
      el.style.display = "none";
    }

  });

  const ativa = document.getElementById(id);

  if(ativa){
    ativa.style.display = id === "inicio" ? "grid" : "block";
  }

  if (id === "evolucaoSec") {
    aplicarTemaPainel();
    setTimeout(desenharGrafico, 0);
  }

  document.querySelectorAll("[data-section-target]").forEach(botao => {
    botao.classList.toggle(
      "ativo",
      botao.getAttribute("data-section-target") === id
    );
  });

}

function obterUsuarioLogado() {
  return appState.currentProfile || null;
}

function usuarioEhAdmin() {
  const usuario = obterUsuarioLogado();
  return usuario && usuario.tipo === "profissional";
}

function montarEndereco(usuario) {
  if (usuario.enderecoLivre) {
    return usuario.enderecoLivre;
  }

  const partes = [
    usuario.rua,
    usuario.numero,
    usuario.bairro,
    usuario.cidade,
    usuario.estado
  ].filter(Boolean);

  return partes.length ? partes.join(", ") : "Não informado";
}

function montarAvatar(usuario) {
  if (usuario.fotoPerfil) {
    return `<img src="${usuario.fotoPerfil}" alt="Foto de perfil">`;
  }

  const inicial = escaparHTML((usuario.nome || "?").charAt(0).toUpperCase());
  return `<span>${inicial}</span>`;
}

function obterConsultasDoPaciente(cpf) {
  const usuario = appState.usuarios.find(u => u.cpf === cpf);
  if (!usuario) return [];
  return appState.consultas.filter(c => c.pacienteId === usuario.uid);
}

function obterAtendimentosDoProfissional(cpf) {
  const usuario = appState.usuarios.find(u => u.cpf === cpf);
  if (!usuario) return [];
  return appState.consultas.filter(c =>
    c.profissionalId === usuario.uid ||
    c.status === "Confirmada"
  );
}

function preencherFormularioPerfil(usuario) {
  const campos = {
    perfilNome: usuario.nome || "",
    perfilNascimento: usuario.data || "",
    perfilCpf: formatarCPF(usuario.cpf || ""),
    perfilEndereco: montarEndereco(usuario),
    perfilTelefone: usuario.telefone || "",
    perfilEmail: usuario.email || "",
    perfilSaude: usuario.informacoesSaude || "",
    perfilExames: usuario.exames || "",
    perfilCargo: usuario.cargo || "",
    perfilRegistro: usuario.registroProfissional || "",
    perfilEspecialidade: usuario.especialidade || ""
  };

  Object.entries(campos).forEach(([id, valor]) => {
    const el = document.getElementById(id);
    if (el) el.value = valor;
  });
}

async function renderizarMeuPerfil() {
  const box = document.getElementById("meuPerfilConteudo");
  if (!box) return;

  const usuario = obterUsuarioLogado();
  if (!usuario) {
    box.innerHTML = '<p>Não há usuário logado.</p>';
    return;
  }

  const tipo = usuario.tipo;
  const consultas = tipo === "paciente" ? obterConsultasDoPaciente(usuario.cpf) : obterAtendimentosDoProfissional(usuario.cpf);
  const historico = appState.historicos[usuario.cpf] || [];

  const consultasHtml = consultas.length
    ? consultas.map(c => `${formatarDataConsulta(c.data)} às ${c.hora} - ${c.status}`).join("<br>")
    : "Nenhuma consulta agendada.";

  let html = '';

  html += '<div class="perfil-header">';
  html += '<div class="perfil-avatar">' + montarAvatar(usuario) + '</div>';
  html += '<div class="perfil-detalhes">';
  html += `<h3>${escaparHTML(usuario.nome || "-")}</h3>`;
  html += `<p><strong>CPF:</strong> ${formatarCPF(usuario.cpf || "")}</p>`;
  html += `<p><strong>Role:</strong> ${escaparHTML(tipo === "paciente" ? "Paciente" : "Profissional")}</p>`;
  html += '</div>';
  html += '</div>';

  if (tipo === "paciente") {
    html += '<div class="perfil-card">';
    html += `<p><strong>Telefone:</strong> ${escaparHTML(usuario.telefone || "Não informado")}</p>`;
    html += `<p><strong>Endereço:</strong> ${escaparHTML(montarEndereco(usuario))}</p>`;
    html += `<p><strong>Histórico:</strong> ${historico.length ? historico.map(h => escaparHTML(h.descricao)).join("<br>") : "Nenhum histórico registrado."}</p>`;
    html += `<p><strong>Consultas:</strong><br>${consultasHtml}</p>`;
    html += '</div>';
  } else {
    html += '<div class="perfil-card">';
    html += `<p><strong>Registro:</strong> ${escaparHTML(usuario.registroProfissional || "Não informado")}</p>`;
    html += `<p><strong>Especialidade:</strong> ${escaparHTML(usuario.especialidade || "Não informado")}</p>`;
    html += `<p><strong>Consultas:</strong><br>${consultasHtml}</p>`;
    html += '</div>';
  }

  box.innerHTML = html;
}

async function salvarMeuPerfil() {
  const usuario = obterUsuarioLogado();
  if (!usuario) return;

  const dadosAtualizados = {
    nome: obterValor("perfilNome") || usuario.nome,
    telefone: obterValor("perfilTelefone"),
    email: obterValor("perfilEmail") || usuario.email
  };

  if (usuario.tipo === "paciente") {
    dadosAtualizados.data = obterValor("perfilNascimento");
    dadosAtualizados.informacoesSaude = obterValor("perfilSaude");
    dadosAtualizados.exames = obterValor("perfilExames");
    dadosAtualizados.enderecoLivre = obterValor("perfilEndereco");
  } else {
    dadosAtualizados.cargo = obterValor("perfilCargo");
    dadosAtualizados.registroProfissional = obterValor("perfilRegistro");
    dadosAtualizados.especialidade = obterValor("perfilEspecialidade");
  }

  const atualizado = await window.firebaseService.updateUserDoc(usuario.uid, dadosAtualizados);
  appState.currentProfile = atualizado;
  appState.usuarios = await carregarUsuarios();

  mostrarMensagem("Perfil atualizado!", "sucesso");
  renderizarMeuPerfil();
}

async function alterarFotoPerfil(input) {
  const arquivo = input.files && input.files[0];
  if (!arquivo) return;

  if (!arquivo.type.startsWith("image/")) {
    mostrarMensagem("Selecione uma imagem válida", "erro");
    return;
  }

  const usuario = obterUsuarioLogado();
  if (!usuario) return;

  try {
    const url = await window.firebaseService.uploadProfilePhoto(usuario.uid, arquivo);
    appState.currentProfile.fotoPerfil = url;
    appState.usuarios = await carregarUsuarios();
    mostrarMensagem("Foto atualizada!", "sucesso");
    renderizarMeuPerfil();
  } catch (error) {
    console.error(error);
    mostrarMensagem("Falha ao enviar a foto. Tente novamente.", "erro");
  }
}

async function salvarEdicaoPaciente() {
  const cpf = document.getElementById("editCpf").value;
  const nome = document.getElementById("editNome").value;
  const telefone = document.getElementById("editTelefone").value;

  const usuarios = await carregarUsuarios();
  const paciente = usuarios.find(u => u.cpf === cpf);

  if (!paciente) return;

  const atualizado = await window.firebaseService.updateUserDoc(paciente.uid, {
    nome,
    telefone
  });

  if (appState.currentProfile && appState.currentProfile.cpf === cpf) {
    appState.currentProfile = atualizado;
  }

  appState.usuarios = await carregarUsuarios();

  mostrarMensagem("Paciente atualizado!", "sucesso");
  await mostrarPacientes();

  if (window.bootstrap && document.getElementById("modalEditarPaciente")) {
    const modal = window.bootstrap.Modal.getInstance(document.getElementById("modalEditarPaciente"));
    if (modal) {
      modal.hide();
    }
  }
}


