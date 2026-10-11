<?php
session_start();
$usersFile = __DIR__ . '/data/users.json';
$isAdmin = false;
if (!empty($_SESSION['user_id']) && empty($_SESSION['logged_out']) && file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?: [];
    foreach ($users as $u) {
        if ($u['id'] === $_SESSION['user_id'] && ($u['role'] ?? '') === 'ADMIN') {
            $isAdmin = true;
            break;
        }
    }
}

if (!$isAdmin) {
    header('Location: index.php?login=required');
    exit;
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" name="viewport"/>
  <title>Menu Scan — Administration Équipe</title>

  <!-- Google Fonts: Inter & Material Symbols Outlined -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>

  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- jsPDF & autoTable CDN for PDF Export -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>

  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              dark: '#2B1D17',
              'dark-hover': '#3D2A22',
              cream: '#FDFBF7',
              surface: '#F4ECE4',
              border: '#E8DDD3',
              text: '#2B1D17',
              muted: '#78645A',
              light: '#C49A45',
              'light-hover': '#B08838'
            }
          },
          fontFamily: {
            sans: ['Inter', 'sans-serif']
          }
        }
      }
    }
  </script>

  <style>
    body {
      background-color: #FDFBF7;
      color: #2B1D17;
      font-family: 'Inter', sans-serif;
    }
  </style>
</head>
<body class="min-h-screen bg-brand-cream text-brand-text flex flex-col">

  <!-- EN-TÊTE ADMIN -->
  <header class="bg-brand-dark text-white shadow-md border-b border-white/10 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center text-white shadow-sm font-extrabold text-lg">
          MS
        </div>
        <div>
          <h1 class="text-base font-extrabold tracking-tight text-white leading-tight">Menu Scan — Administration</h1>
          <p class="text-[11px] text-[#D7CCC8]">Gestion privée de l'équipe et des agents terrain</p>
        </div>
      </div>

      <div class="flex items-center gap-3" id="adminHeaderActions">
        <a href="index.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-semibold transition-all">
          <span class="material-symbols-outlined text-[18px]">public</span>
          <span>Voir le site</span>
        </a>
        <button id="adminLogoutBtn" onclick="AdminApp.logout()" type="button" class="hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold transition-all">
          <span class="material-symbols-outlined text-[18px]">logout</span>
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">

    <!-- ECRAN DE CONNEXION ADMIN -->
    <div id="adminAuthSection" class="max-w-md w-full mx-auto my-auto py-12">
      <div class="bg-white rounded-3xl shadow-xl border border-brand-border overflow-hidden">
        <div class="bg-brand-dark p-6 text-white text-center flex flex-col items-center">
          <div class="w-14 h-14 rounded-2xl bg-brand-light/20 flex items-center justify-center text-brand-light mb-3 border border-brand-light/30">
            <span class="material-symbols-outlined text-[32px]">admin_panel_settings</span>
          </div>
          <h2 class="text-xl font-extrabold" id="authFormTitle">Connexion Administrateur</h2>
          <p class="text-xs text-[#D7CCC8] mt-1" id="authFormSubtitle">Accès réservé au responsable de l'équipe</p>
        </div>

        <form id="adminLoginForm" onsubmit="AdminApp.handleLogin(event)" class="p-6 flex flex-col gap-4">
          <div>
            <label class="block text-xs font-bold text-brand-muted mb-1" for="adminEmail">Adresse Email</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-brand-muted text-[18px]">mail</span>
              <input type="email" id="adminEmail" required placeholder="admin@menuscan.ci" class="w-full h-11 pl-10 pr-3 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-light font-medium"/>
            </div>
          </div>

          <div id="authNameField" class="hidden">
            <label class="block text-xs font-bold text-brand-muted mb-1" for="adminName">Nom complet</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-brand-muted text-[18px]">person</span>
              <input type="text" id="adminName" placeholder="Administrateur Principal" class="w-full h-11 pl-10 pr-3 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-light font-medium"/>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-brand-muted mb-1" for="adminPassword">Mot de passe</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3 text-brand-muted text-[18px]">lock</span>
              <input type="password" id="adminPassword" required placeholder="••••••••" class="w-full h-11 pl-10 pr-3 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-light font-medium"/>
            </div>
          </div>

          <button type="submit" id="adminSubmitBtn" class="w-full h-12 rounded-xl bg-brand-dark hover:bg-brand-dark-hover text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-2">
            <span>SE CONNECTER</span>
            <span class="material-symbols-outlined text-[20px] text-brand-light">arrow_forward</span>
          </button>
        </form>
      </div>
    </div>

    <!-- TABLEAU DE BORD ADMIN (MASQUÉ SI NON CONNECTÉ) -->
    <div id="adminDashboardSection" class="hidden flex flex-col gap-8">
      
      <!-- CARTE DE SUCCÈS : MOT DE PASSE GÉNÉRÉ -->
      <div id="credentialsAlert" class="hidden bg-emerald-950 text-white rounded-2xl p-6 shadow-xl border border-emerald-500/40 relative">
        <button onclick="document.getElementById('credentialsAlert').classList.add('hidden')" type="button" class="absolute top-4 right-4 text-emerald-300 hover:text-white">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
            <span class="material-symbols-outlined text-[28px]">key</span>
          </div>
          <div class="flex-1">
            <h3 class="text-base font-extrabold text-emerald-300">Nouveau compte agent créé avec succès !</h3>
            <p class="text-xs text-emerald-100/80 mt-1">Transmettez ces identifiants à l'agent pour qu'il puisse se connecter :</p>
            
            <div class="mt-4 bg-black/40 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-sm">
              <div>
                <div><span class="text-emerald-400 text-xs font-sans">Email :</span> <strong id="credEmail" class="text-white"></strong></div>
                <div class="mt-1"><span class="text-emerald-400 text-xs font-sans">Mot de passe :</span> <strong id="credPass" class="text-amber-300 font-extrabold text-base"></strong></div>
              </div>
              <button onclick="AdminApp.copyCredentials()" type="button" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold font-sans flex items-center gap-1.5 transition-colors shadow-sm">
                <span class="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Copier les accès</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- FORMULAIRE DE CRÉATION D'AGENT -->
      <section class="bg-white rounded-2xl shadow-sm border border-brand-border p-6 flex flex-col gap-6">
        <div class="flex items-center justify-between pb-4 border-b border-brand-border">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-brand-light/15 text-brand-light flex items-center justify-center font-bold">
              <span class="material-symbols-outlined text-[24px]">person_add</span>
            </div>
            <div>
              <h2 class="text-lg font-bold text-brand-text">Ajouter un nouveau membre d'équipe</h2>
              <p class="text-xs text-brand-muted">Le mot de passe sera généré automatiquement et vous sera affiché</p>
            </div>
          </div>
        </div>

        <form onsubmit="AdminApp.handleCreateUser(event)" class="flex flex-col gap-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-brand-muted mb-1" for="newUserName">Nom & Prénom *</label>
              <input type="text" id="newUserName" required placeholder="Ex: Marc Koffi" class="w-full h-11 px-3.5 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text font-medium focus:outline-none focus:ring-2 focus:ring-brand-light"/>
            </div>

            <div>
              <label class="block text-xs font-bold text-brand-muted mb-1" for="newUserEmail">Adresse Email *</label>
              <input type="email" id="newUserEmail" required placeholder="agent1@menuscan.ci" class="w-full h-11 px-3.5 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text font-medium focus:outline-none focus:ring-2 focus:ring-brand-light"/>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-brand-muted mb-1" for="newUserRole">Rôle système</label>
              <select id="newUserRole" class="w-full h-11 px-3.5 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text font-semibold focus:outline-none focus:ring-2 focus:ring-brand-light">
                <option value="AGENT">Agent terrain (Prospecteur)</option>
                <option value="ADMIN">Administrateur (Accès gestion complet)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-brand-muted mb-1" for="newUserCustomPass">Mot de passe personnalisé (Optionnel)</label>
              <input type="text" id="newUserCustomPass" placeholder="Laisser vide pour générer auto (Recommandé)" class="w-full h-11 px-3.5 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text font-mono focus:outline-none focus:ring-2 focus:ring-brand-light"/>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-brand-muted mb-2">Communes assignées à cet agent :</label>
            <div class="flex flex-wrap gap-2" id="communesCheckboxGrid">
              <!-- Dynamique via JS -->
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button type="submit" class="h-11 px-6 bg-brand-dark hover:bg-brand-dark-hover text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-brand-light">group_add</span>
              <span>CRÉER LE MEMBRE & GÉNÉRER LES ACCÈS</span>
            </button>
          </div>
        </form>
      </section>

      <!-- LISTE DES MEMBRES D'ÉQUIPE -->
      <section class="bg-white rounded-2xl shadow-sm border border-brand-border p-6 flex flex-col gap-6">
        <div class="flex items-center justify-between pb-4 border-b border-brand-border">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-brand-light/15 text-brand-light flex items-center justify-center font-bold">
              <span class="material-symbols-outlined text-[24px]">group</span>
            </div>
            <div>
              <h2 class="text-lg font-bold text-brand-text">Équipe commerciale (<span id="userCountBadge">0</span>)</h2>
              <p class="text-xs text-brand-muted">Cliquez sur une commune pour l'attribuer ou la retirer à un agent</p>
            </div>
          </div>
          <button onclick="AdminApp.loadUsers()" type="button" class="p-2 text-brand-muted hover:text-brand-text rounded-lg hover:bg-brand-surface transition-colors" title="Actualiser la liste">
            <span class="material-symbols-outlined text-[20px]">refresh</span>
          </button>
        </div>

        <div id="usersListContainer" class="flex flex-col gap-4">
          <!-- Dynamique via JS -->
        </div>
      </section>

      <!-- EXPORT DE DONNÉES & ZONE DANGER -->
      <section class="bg-white rounded-2xl shadow-sm border border-brand-border p-6 flex flex-col gap-6">
        <h2 class="text-lg font-bold text-brand-text pb-3 border-b border-brand-border">Rapports & Actions Globales</h2>
        
        <div class="flex flex-wrap gap-4">
          <button onclick="AdminApp.exportPDF()" type="button" class="h-11 px-5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Rapport PDF Complet (Visites + Restaurants)</span>
          </button>
          <button onclick="AdminApp.exportCSV()" type="button" class="h-11 px-5 rounded-xl bg-brand-dark hover:bg-brand-dark-hover text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">table_chart</span>
            <span>Export CSV Brut</span>
          </button>
        </div>

        <div class="mt-4 pt-4 border-t border-rose-200 bg-rose-50/50 p-4 rounded-xl flex flex-col gap-3">
          <div class="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <span class="material-symbols-outlined text-[20px]">warning</span>
            <span>Zone de réinitialisation</span>
          </div>
          <p class="text-xs text-rose-700">Permet d'effacer l'ensemble de l'historique des visites pour repartir sur une nouvelle campagne.</p>
          <div>
            <button onclick="AdminApp.resetVisits(this)" type="button" class="h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">delete_sweep</span>
              <span>Réinitialiser toutes les visites</span>
            </button>
          </div>
        </div>
      </section>

    </div>

  </main>

  <!-- Toast notification -->
  <div id="adminToast" class="fixed top-6 left-1/2 -translate-x-1/2 z-50 transform -translate-y-24 opacity-0 transition-all duration-300 pointer-events-none w-11/12 max-w-sm">
    <div class="bg-brand-dark/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-brand-light/30">
      <span id="adminToastIcon" class="material-symbols-outlined text-[20px] text-brand-light">check_circle</span>
      <span id="adminToastText" class="text-[13px] font-medium leading-snug">Notification</span>
    </div>
  </div>

  <script>
    const COMMUNES_LIST = ['Cocody', 'Marcory', 'Plateau', 'Yopougon', 'Treichville', 'Koumassi', 'Port-Bouët'];

    const AdminApp = {
      currentUser: null,
      users: [],
      restaurants: [],
      visits: [],

      async init() {
        this.renderCommunesCheckboxes();
        await this.checkAuth();
      },

      renderCommunesCheckboxes() {
        const container = document.getElementById('communesCheckboxGrid');
        if (!container) return;
        container.innerHTML = COMMUNES_LIST.map(c => `
          <label class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-cream border border-brand-border text-xs font-bold text-brand-text cursor-pointer hover:bg-white transition-colors">
            <input type="checkbox" value="${c}" class="commune-checkbox rounded text-brand-light focus:ring-brand-light"/>
            <span>${c}</span>
          </label>
        `).join('');
      },

      async checkAuth() {
        try {
          const res = await fetch('api.php?action=me').then(r => r.json());
          if (res.success && res.user && res.user.role === 'ADMIN') {
            this.currentUser = res.user;
            this.showDashboard();
          } else {
            this.showLogin();
          }
        } catch (e) {
          console.error(e);
          this.showLogin();
        }
      },

      showLogin() {
        document.getElementById('adminAuthSection').classList.remove('hidden');
        document.getElementById('adminDashboardSection').classList.add('hidden');
        document.getElementById('adminLogoutBtn').classList.add('hidden');
      },

      showDashboard() {
        document.getElementById('adminAuthSection').classList.add('hidden');
        document.getElementById('adminDashboardSection').classList.remove('hidden');
        document.getElementById('adminLogoutBtn').classList.remove('hidden');
        this.loadUsers();
        this.loadData();
      },

      async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;

        try {
          const res = await fetch('api.php?action=login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password })
          }).then(r => r.json());

          if (res.success && res.user) {
            if (res.user.role !== 'ADMIN') {
              alert('Accès refusé. Ce compte n\'est pas un compte Administrateur.');
              return;
            }
            this.currentUser = res.user;
            this.showDashboard();
          } else {
            alert(res.error || 'Identifiants incorrects.');
          }
        } catch (err) {
          alert('Erreur réseau.');
        }
      },

      async logout() {
        await fetch('api.php?action=logout');
        this.currentUser = null;
        window.location.href = 'index.php';
      },

      async loadUsers() {
        try {
          const res = await fetch('api.php?action=users').then(r => r.json());
          if (res.success) {
            this.users = res.users || [];
            this.renderUsers();
          }
        } catch (e) {
          console.error(e);
        }
      },

      async loadData() {
        try {
          const [restRes, visRes] = await Promise.all([
            fetch('api.php?action=restaurants').then(r => r.json()),
            fetch('api.php?action=visits').then(r => r.json())
          ]);
          this.restaurants = restRes.restaurants || [];
          this.visits = visRes.visits || [];
        } catch (e) {
          console.error(e);
        }
      },

      renderUsers() {
        const container = document.getElementById('usersListContainer');
        const badge = document.getElementById('userCountBadge');
        if (badge) badge.textContent = this.users.length;
        if (!container) return;

        if (!this.users.length) {
          container.innerHTML = `<div class="text-center py-8 text-xs text-brand-muted font-medium">Aucun utilisateur enregistré dans le système.</div>`;
          return;
        }

        container.innerHTML = this.users.map(u => {
          const assigned = u.assigned_communes || [];
          const isSelf = this.currentUser && u.id === this.currentUser.id;

          return `
            <div class="p-5 rounded-2xl bg-brand-cream border border-brand-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div class="flex items-start gap-3">
                <div class="w-11 h-11 rounded-2xl ${u.role === 'ADMIN' ? 'bg-brand-dark text-brand-light' : 'bg-brand-surface text-brand-text'} flex items-center justify-center font-extrabold text-sm flex-shrink-0 border border-brand-border">
                  ${u.name.substring(0,2).toUpperCase()}
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-sm font-bold text-brand-text">${u.name}</h3>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${u.role === 'ADMIN' ? 'bg-brand-dark text-brand-light' : 'bg-amber-100 text-amber-900 border border-amber-300'}">
                      ${u.role}
                    </span>
                    ${isSelf ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Vous</span>' : ''}
                  </div>
                  <div class="text-xs text-brand-muted mt-0.5 flex items-center gap-3 flex-wrap">
                    <span>✉️ ${u.email}</span>
                    ${u.phone ? `<span>📞 ${u.phone}</span>` : ''}
                  </div>

                  <!-- BADGES COMMUNES ASSIGNÉES -->
                  <div class="mt-3 flex items-center gap-1.5 flex-wrap">
                    <span class="text-[11px] font-bold text-brand-muted mr-1">Communes :</span>
                    ${COMMUNES_LIST.map(c => {
                      const hasIt = assigned.includes(c);
                      return `
                        <button type="button" onclick="AdminApp.toggleCommune('${u.id}', '${c}')"
                          class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${hasIt ? 'bg-emerald-700 text-white shadow-sm' : 'bg-white border border-brand-border text-brand-muted hover:bg-brand-surface'}">
                          ${hasIt ? '✓ ' : ''}${c}
                        </button>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>

              <!-- ACTIONS -->
              <div class="flex items-center gap-2 flex-wrap border-t md:border-t-0 pt-3 md:pt-0 border-brand-border justify-end">
                <button onclick="AdminApp.resetPassword('${u.id}', '${u.name}')" type="button" class="px-3 py-1.5 rounded-xl bg-white border border-brand-border hover:bg-brand-surface text-brand-text text-xs font-bold transition-all shadow-sm flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px] text-amber-600">key</span>
                  <span>Réinit. mot de passe</span>
                </button>
                ${!isSelf ? `
                  <button onclick="AdminApp.toggleRole('${u.id}', '${u.role}')" type="button" class="px-3 py-1.5 rounded-xl bg-white border border-brand-border hover:bg-brand-surface text-brand-text text-xs font-bold transition-all shadow-sm">
                    Passer en ${u.role === 'ADMIN' ? 'AGENT' : 'ADMIN'}
                  </button>
                  <button onclick="AdminApp.deleteUser('${u.id}', '${(u.name || '').replace(/'/g, "\\'")}', event.currentTarget)" type="button" class="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all flex items-center gap-1" title="Supprimer le membre">
                    <span class="material-symbols-outlined text-[18px] pointer-events-none">delete</span>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');
      },

      async handleCreateUser(e) {
        e.preventDefault();
        const name = document.getElementById('newUserName').value.trim();
        const email = document.getElementById('newUserEmail').value.trim();
        const role = document.getElementById('newUserRole').value;
        const customPass = document.getElementById('newUserCustomPass').value.trim();

        const selectedCommunes = Array.from(document.querySelectorAll('.commune-checkbox:checked')).map(cb => cb.value);

        try {
          const res = await fetch('api.php?action=create_user', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              name, email, role,
              assigned_communes: selectedCommunes,
              password: customPass
            })
          }).then(r => r.json());

          if (res.success) {
            // Afficher le bandeau de succès avec le mot de passe
            document.getElementById('credEmail').textContent = res.user.email;
            document.getElementById('credPass').textContent = res.generated_password;
            document.getElementById('credentialsAlert').classList.remove('hidden');

            // Reset form
            e.target.reset();
            this.renderCommunesCheckboxes();
            await this.loadUsers();

            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            alert(res.error || 'Erreur lors de la création');
          }
        } catch (err) {
          alert('Erreur réseau');
        }
      },

      copyCredentials() {
        const email = document.getElementById('credEmail').textContent;
        const pass = document.getElementById('credPass').textContent;
        const text = `Identifiants Menu Scan :\n- Email : ${email}\n- Mot de passe : ${pass}\n- Lien : ${window.location.origin}/index.php`;

        navigator.clipboard.writeText(text).then(() => {
          alert('Identifiants copiés dans le presse-papier !');
        });
      },

      async toggleCommune(userId, commune) {
        try {
          const res = await fetch('api.php?action=toggle_user_commune', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: userId, commune })
          }).then(r => r.json());

          if (res.success) {
            await this.loadUsers();
          } else {
            alert(res.error || 'Erreur');
          }
        } catch (e) {
          alert('Erreur réseau');
        }
      },

      async resetPassword(userId, userName) {
        try {
          const res = await fetch('api.php?action=reset_user_password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: userId })
          }).then(r => r.json());

          if (res.success) {
            const user = this.users.find(u => u.id === userId);
            document.getElementById('credEmail').textContent = user ? user.email : '';
            document.getElementById('credPass').textContent = res.new_password;
            document.getElementById('credentialsAlert').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            alert(res.error || 'Erreur lors de la réinitialisation');
          }
        } catch (e) {
          alert('Erreur réseau');
        }
      },

      async toggleRole(userId, currentRole) {
        const newRole = currentRole === 'ADMIN' ? 'AGENT' : 'ADMIN';
        try {
          const res = await fetch('api.php?action=update_user_role', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: userId, role: newRole })
          }).then(r => r.json());

          if (res.success) {
            await this.loadUsers();
          } else {
            alert(res.error || 'Erreur');
          }
        } catch (e) {
          alert('Erreur réseau');
        }
      },

      showToast(message, type = 'success') {
        const toast = document.getElementById('adminToast');
        const text = document.getElementById('adminToastText');
        const icon = document.getElementById('adminToastIcon');
        if (!toast || !text) return;
        text.textContent = message;
        if (icon) icon.textContent = type === 'success' ? 'check_circle' : 'info';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
        setTimeout(() => {
          toast.style.transform = 'translateX(-50%) translateY(-6rem)';
          toast.style.opacity = '0';
        }, 3000);
      },

      async deleteUser(userId, userName, btnElement) {
        if (!btnElement) return;
        // First click: show confirmation state
        if (btnElement.dataset.confirming !== 'true') {
          btnElement.dataset.confirming = 'true';
          const origClass = btnElement.className;
          const origHTML = btnElement.innerHTML;
          btnElement.className = 'px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1 animate-pulse';
          btnElement.innerHTML = `<span class="material-symbols-outlined text-[16px] pointer-events-none">warning</span><span>Confirmer ?</span>`;
          setTimeout(() => {
            if (btnElement.dataset.confirming === 'true') {
              btnElement.dataset.confirming = 'false';
              btnElement.className = origClass;
              btnElement.innerHTML = origHTML;
            }
          }, 4000);
          return;
        }
        // Second click: do delete
        btnElement.dataset.confirming = 'false';
        btnElement.disabled = true;
        btnElement.style.opacity = '0.5';
        try {
          const res = await fetch('api.php?action=delete_user', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: userId })
          }).then(r => r.json());

          if (res.success) {
            await this.loadUsers();
            this.showToast('Membre supprimé avec succès ✓');
          } else {
            btnElement.disabled = false;
            btnElement.style.opacity = '1';
            alert(res.error || 'Erreur lors de la suppression');
          }
        } catch (e) {
          btnElement.disabled = false;
          btnElement.style.opacity = '1';
          alert('Erreur réseau');
        }
      },

      exportPDF() {
        const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
        if (!jsPDF) { alert('Bibliothèque PDF non chargée'); return; }

        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.setTextColor(43, 29, 23);
        doc.text('Menu Scan — Rapport Global d\'Administration', 14, 15);
        doc.setFontSize(10);
        doc.setTextColor(120, 100, 90);
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — Total Établissements: ${this.restaurants.length} | Total Visites: ${this.visits.length}`, 14, 22);

        const restHeaders = [['Nom', 'Commune', 'Quartier', 'Adresse', 'Téléphone', 'Statut']];
        const restData = this.restaurants.map(r => [r.name, r.commune, r.zone||r.quartier||'', r.address, r.phone||'', r.status]);

        doc.autoTable({
          head: restHeaders,
          body: restData,
          startY: 27,
          theme: 'grid',
          headStyles: { fillColor: [43, 29, 23], textColor: [255, 255, 255], fontStyle: 'bold' }
        });

        const filename = `rapport_admin_menuscan_${new Date().toISOString().slice(0,10)}.pdf`;
        try {
          // Téléchargement direct (window.open est bloqué par les navigateurs)
          const blob = doc.output('blob');
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          this.showToast('Rapport PDF téléchargé avec succès ✓');
        } catch (e) {
          doc.save(filename);
        }
      },

      exportCSV() {
        const jsonStr = JSON.stringify({ users: this.users, restaurants: this.restaurants, visits: this.visits }, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_menuscan_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      },

      pendingResetVisitsAdmin: false,

      async resetVisits(btnElement) {
        if (!this.pendingResetVisitsAdmin) {
          this.pendingResetVisitsAdmin = true;
          if (btnElement) {
            btnElement.className = "h-10 px-4 bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 animate-pulse";
            btnElement.innerHTML = `<span class="material-symbols-outlined text-[16px]">warning</span><span>Confirmer la réinitialisation ?</span>`;
          }
          setTimeout(() => {
            this.pendingResetVisitsAdmin = false;
            if (btnElement) {
              btnElement.className = "h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5";
              btnElement.innerHTML = `<span class="material-symbols-outlined text-[16px]">delete_sweep</span><span>Réinitialiser toutes les visites</span>`;
            }
          }, 4000);
          return;
        }

        this.pendingResetVisitsAdmin = false;
        try {
          const res = await fetch('api.php?action=reset_visits', { method: 'POST' }).then(r => r.json());
          if (res.success) {
            await this.loadData();
          } else {
            alert(res.error || 'Erreur');
          }
        } catch (e) {
          alert('Erreur réseau');
        }
      }
    };

    window.addEventListener('DOMContentLoaded', () => AdminApp.init());
  </script>
</body>
</html>
