<?php
session_start();
$usersFile = __DIR__ . '/data/users.json';
$currentUser = null;
if (!empty($_SESSION['user_id']) && empty($_SESSION['logged_out']) && file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?: [];
    foreach ($users as $u) {
        if ($u['id'] === $_SESSION['user_id']) {
            $currentUser = $u;
            break;
        }
    }
}

if (!$currentUser) {
    header('Location: login.php?login=required&redirect=admin.php');
    exit;
}

if (($currentUser['role'] ?? '') !== 'ADMIN') {
    header('Location: index.php?error=admin_only');
    exit;
}
?>
<!DOCTYPE html>
<html lang="fr" class="h-full">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"/>
  <meta name="description" content="Menu Scan Abidjan — Panneau d'Administration et Gestion d'Équipe"/>
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
        screens: {
          'xs': '380px',
          'sm': '640px',
          'md': '768px',
          'lg': '1024px',
          'xl': '1280px',
          '2xl': '1536px'
        },
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
    };
  </script>

  <style>
    body {
      background-color: #FDFBF7;
      color: #2B1D17;
      font-family: 'Inter', sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    input, select, textarea {
      font-size: 16px !important;
    }
    @media (min-width: 640px) {
      input, select, textarea {
        font-size: 13px !important;
      }
    }
  </style>
</head>
<body class="min-h-full bg-brand-cream text-brand-text flex flex-col antialiased selection:bg-brand-light selection:text-white">

  <!-- EN-TÊTE ADMIN RESPONSIVE -->
  <header class="bg-brand-dark text-white shadow-md border-b border-white/10 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-light flex items-center justify-center text-white shadow-sm font-extrabold text-sm sm:text-base flex-shrink-0">
          MS
        </div>
        <div class="min-w-0">
          <h1 class="text-sm sm:text-base font-extrabold tracking-tight text-white leading-tight truncate">
            Menu Scan <span class="hidden sm:inline">— Administration</span><span class="sm:hidden text-brand-light text-xs font-semibold"> Admin</span>
          </h1>
          <p class="text-[10px] sm:text-[11px] text-[#D7CCC8] truncate hidden sm:block">Gestion de l'équipe et des agents terrain Abidjan</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 sm:gap-3 flex-shrink-0" id="adminHeaderActions">
        <a href="index.php" class="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-semibold transition-all" title="Aller sur le tableau de bord de prospection">
          <span class="material-symbols-outlined text-[16px] sm:text-[18px]">public</span>
          <span class="hidden xs:inline">Prospection</span>
        </a>
        <button id="adminLogoutBtn" onclick="AdminApp.logout()" type="button" class="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold transition-all" title="Se déconnecter">
          <span class="material-symbols-outlined text-[16px] sm:text-[18px]">logout</span>
          <span class="hidden xs:inline">Déconnexion</span>
        </button>
      </div>
    </div>
  </header>

  <main class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 flex flex-col gap-6 sm:gap-8">

    <!-- BANNIÈRE DE BIENVENUE & KPI STATS ADMIN -->
    <section class="flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="text-xl sm:text-2xl font-extrabold text-brand-text">Panneau de Contrôle Administrateur</h2>
          <p class="text-xs sm:text-sm text-brand-muted">Gérez les comptes de l'équipe commerciale, les affectations géographiques et les données.</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
            <span class="w-2 h-2 rounded-full bg-amber-600"></span> Session Administrateur Active
          </span>
        </div>
      </div>

      <!-- KPI Grid 3 Colonnes -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-brand-border shadow-sm flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-brand-cream border border-brand-border flex items-center justify-center text-brand-dark flex-shrink-0">
            <span class="material-symbols-outlined text-[24px]">group</span>
          </div>
          <div>
            <span class="text-xs font-bold text-brand-muted block">Équipe commerciale</span>
            <span class="text-xl sm:text-2xl font-extrabold text-brand-text" id="kpiAdminUsers">0 Membre</span>
          </div>
        </div>
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-brand-border shadow-sm flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-brand-cream border border-brand-border flex items-center justify-center text-brand-dark flex-shrink-0">
            <span class="material-symbols-outlined text-[24px]">restaurant</span>
          </div>
          <div>
            <span class="text-xs font-bold text-brand-muted block">Restaurants répertoriés</span>
            <span class="text-xl sm:text-2xl font-extrabold text-brand-text" id="kpiAdminRestaurants">0 Établissement</span>
          </div>
        </div>
        <div class="bg-white rounded-2xl p-4 sm:p-5 border border-brand-border shadow-sm flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-brand-cream border border-brand-border flex items-center justify-center text-brand-dark flex-shrink-0">
            <span class="material-symbols-outlined text-[24px]">assignment_turned_in</span>
          </div>
          <div>
            <span class="text-xs font-bold text-brand-muted block">Visites terrain effectuées</span>
            <span class="text-xl sm:text-2xl font-extrabold text-brand-text" id="kpiAdminVisits">0 Visite</span>
          </div>
        </div>
      </div>
    </section>

    <!-- TABLEAU DE BORD ADMIN -->
    <div id="adminDashboardSection" class="flex flex-col gap-6 sm:gap-8">
      
      <!-- CARTE DE SUCCÈS : MOT DE PASSE GÉNÉRÉ -->
      <div id="credentialsAlert" class="hidden bg-emerald-950 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-emerald-500/40 relative">
        <button onclick="document.getElementById('credentialsAlert').classList.add('hidden')" type="button" class="absolute top-3 right-3 sm:top-4 sm:right-4 text-emerald-300 hover:text-white p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div class="flex items-start gap-3 sm:gap-4">
          <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
            <span class="material-symbols-outlined text-[24px] sm:text-[28px]">key</span>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm sm:text-base font-extrabold text-emerald-300">Nouveau compte créé avec succès !</h3>
            <p class="text-xs text-emerald-100/80 mt-1">Transmettez ces identifiants à l'agent pour qu'il puisse se connecter :</p>
            
            <div class="mt-3 bg-black/40 border border-emerald-500/30 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-sm">
              <div class="min-w-0 break-all">
                <div><span class="text-emerald-400 text-xs font-sans">Email :</span> <strong id="credEmail" class="text-white"></strong></div>
                <div class="mt-1"><span class="text-emerald-400 text-xs font-sans">Mot de passe :</span> <strong id="credPass" class="text-amber-300 font-extrabold text-sm sm:text-base"></strong></div>
              </div>
              <button onclick="AdminApp.copyCredentials()" type="button" class="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold font-sans flex items-center justify-center gap-1.5 transition-colors shadow-sm flex-shrink-0">
                <span class="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Copier les accès</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- FORMULAIRE DE CRÉATION D'UN MEMBRE D'ÉQUIPE -->
      <section class="bg-white rounded-2xl shadow-sm border border-brand-border p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
        <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-brand-border">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-brand-light/15 text-brand-light flex items-center justify-center font-bold flex-shrink-0">
              <span class="material-symbols-outlined text-[24px]">person_add</span>
            </div>
            <div>
              <h3 class="text-base sm:text-lg font-bold text-brand-text">Ajouter un nouveau membre d'équipe</h3>
              <p class="text-xs text-brand-muted">Générez un mot de passe ou attribuez-en un sur mesure</p>
            </div>
          </div>
        </div>

        <form onsubmit="AdminApp.handleCreateUser(event)" class="flex flex-col gap-4 sm:gap-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label class="block text-xs font-bold text-brand-muted mb-1" for="newUserName">Nom & Prénom *</label>
              <input type="text" id="newUserName" required placeholder="Ex: Marc Koffi" class="w-full h-11 px-3.5 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text font-medium focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"/>
            </div>

            <div>
              <label class="block text-xs font-bold text-brand-muted mb-1" for="newUserEmail">Adresse Email *</label>
              <input type="email" id="newUserEmail" required placeholder="agent1@menuscan.ci" class="w-full h-11 px-3.5 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text font-medium focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"/>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label class="block text-xs font-bold text-brand-muted mb-1" for="newUserRole">Rôle système</label>
              <select id="newUserRole" class="w-full h-11 px-3.5 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text font-semibold focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white">
                <option value="AGENT">Agent commercial (Prospection terrain)</option>
                <option value="ADMIN">Administrateur (Gestion complète de l'équipe)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-brand-muted mb-1" for="newUserCustomPass">Mot de passe personnalisé (Optionnel)</label>
              <input type="text" id="newUserCustomPass" placeholder="Laisser vide pour générer auto" class="w-full h-11 px-3.5 rounded-xl bg-brand-cream border border-brand-border text-xs text-brand-text font-mono focus:outline-none focus:ring-2 focus:ring-brand-light focus:bg-white"/>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-brand-muted mb-2">Communes assignées à ce membre :</label>
            <div class="flex flex-wrap gap-1.5 sm:gap-2" id="communesCheckboxGrid">
              <!-- Rendu dynamique via JS -->
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button type="submit" class="w-full sm:w-auto h-11 px-6 bg-brand-dark hover:bg-brand-dark-hover text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-brand-light">group_add</span>
              <span>CRÉER LE MEMBRE & GÉNÉRER LES ACCÈS</span>
            </button>
          </div>
        </form>
      </section>

      <!-- LISTE DES MEMBRES D'ÉQUIPE -->
      <section class="bg-white rounded-2xl shadow-sm border border-brand-border p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
        <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-brand-border">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-brand-light/15 text-brand-light flex items-center justify-center font-bold flex-shrink-0">
              <span class="material-symbols-outlined text-[24px]">group</span>
            </div>
            <div>
              <h3 class="text-base sm:text-lg font-bold text-brand-text">Équipe & Utilisateurs (<span id="userCountBadge">0</span>)</h3>
              <p class="text-xs text-brand-muted">Gérez les rôles, les réinitialisations de mot de passe et les communes</p>
            </div>
          </div>
          <button onclick="AdminApp.loadUsers()" type="button" class="p-2 text-brand-muted hover:text-brand-text rounded-lg hover:bg-brand-surface transition-colors" title="Actualiser la liste">
            <span class="material-symbols-outlined text-[20px]">refresh</span>
          </button>
        </div>

        <div id="usersListContainer" class="flex flex-col gap-3 sm:gap-4">
          <!-- Dynamique via JS -->
        </div>
      </section>

      <!-- EXPORT DE DONNÉES & ZONE DE CONTRÔLE -->
      <section class="bg-white rounded-2xl shadow-sm border border-brand-border p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
        <h3 class="text-base sm:text-lg font-bold text-brand-text pb-3 border-b border-brand-border">Rapports & Actions Globales</h3>
        
        <div class="flex flex-col sm:flex-row flex-wrap gap-3">
          <button onclick="AdminApp.exportPDF()" type="button" class="w-full sm:w-auto h-11 px-5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Rapport PDF Complet (Visites + Restaurants)</span>
          </button>
          <button onclick="AdminApp.exportCSV()" type="button" class="w-full sm:w-auto h-11 px-5 rounded-xl bg-brand-dark hover:bg-brand-dark-hover text-white text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-[18px]">table_chart</span>
            <span>Sauvegarde JSON / Export Brut</span>
          </button>
        </div>

        <div class="pt-4 border-t border-rose-200 bg-rose-50/50 p-4 rounded-xl flex flex-col gap-3">
          <div class="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <span class="material-symbols-outlined text-[20px]">warning</span>
            <span>Zone de réinitialisation de campagne</span>
          </div>
          <p class="text-xs text-rose-700">Permet d'effacer l'ensemble de l'historique des visites pour redémarrer un nouveau cycle de prospection commerciale.</p>
          <div>
            <button onclick="AdminApp.resetVisits(this)" type="button" class="w-full sm:w-auto h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">delete_sweep</span>
              <span>Réinitialiser toutes les visites</span>
            </button>
          </div>
        </div>
      </section>

    </div>

  </main>

  <!-- Notification Toast Flottant -->
  <div id="adminToast" class="fixed top-6 left-1/2 -translate-x-1/2 z-50 transform -translate-y-24 opacity-0 transition-all duration-300 pointer-events-none w-11/12 max-w-sm">
    <div class="bg-brand-dark/95 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-brand-light/30">
      <span id="adminToastIcon" class="material-symbols-outlined text-[20px] text-brand-light">check_circle</span>
      <span id="adminToastText" class="text-[13px] font-medium leading-snug">Notification</span>
    </div>
  </div>

  <script src="config.js"></script>
  <script>
    const COMMUNES_LIST = ['Cocody', 'Marcory', 'Plateau', 'Yopougon', 'Treichville', 'Koumassi', 'Port-Bouët'];

    function getApiUrl(action) {
      const base = (window.API_BASE !== undefined ? window.API_BASE : '');
      return base + 'api.php?action=' + action;
    }

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
          const res = await fetch(getApiUrl('me'), { credentials: 'include' }).then(r => r.json());
          if (res.success && res.user && res.user.role === 'ADMIN') {
            this.currentUser = res.user;
            await this.loadUsers();
            await this.loadData();
          } else {
            window.location.href = 'login.php?login=required&redirect=admin.php';
          }
        } catch (e) {
          console.error(e);
          window.location.href = 'login.php?login=required&redirect=admin.php';
        }
      },

      async logout() {
        try {
          await fetch(getApiUrl('logout'), { credentials: 'include' });
        } catch(e) {}
        this.currentUser = null;
        window.location.href = 'login.php?msg=logout_success';
      },

      async loadUsers() {
        try {
          const res = await fetch(getApiUrl('users'), { credentials: 'include' }).then(r => r.json());
          if (res.success) {
            this.users = res.users || [];
            this.renderUsers();
            const badge = document.getElementById('userCountBadge');
            const kpi = document.getElementById('kpiAdminUsers');
            if (badge) badge.textContent = this.users.length;
            if (kpi) kpi.textContent = `${this.users.length} Membre${this.users.length > 1 ? 's' : ''}`;
          }
        } catch (e) {
          console.error(e);
        }
      },

      async loadData() {
        try {
          const [restRes, visRes] = await Promise.all([
            fetch(getApiUrl('restaurants'), { credentials: 'include' }).then(r => r.json()),
            fetch(getApiUrl('visits'), { credentials: 'include' }).then(r => r.json())
          ]);
          this.restaurants = restRes.restaurants || [];
          this.visits = visRes.visits || [];

          const kpiRest = document.getElementById('kpiAdminRestaurants');
          const kpiVis = document.getElementById('kpiAdminVisits');
          if (kpiRest) kpiRest.textContent = `${this.restaurants.length} Établissement${this.restaurants.length > 1 ? 's' : ''}`;
          if (kpiVis) kpiVis.textContent = `${this.visits.length} Visite${this.visits.length > 1 ? 's' : ''}`;
        } catch (e) {
          console.error(e);
        }
      },

      renderUsers() {
        const container = document.getElementById('usersListContainer');
        if (!container) return;

        if (!this.users.length) {
          container.innerHTML = `<div class="text-center py-8 text-xs text-brand-muted font-medium">Aucun utilisateur enregistré dans le système.</div>`;
          return;
        }

        container.innerHTML = this.users.map(u => {
          const assigned = u.assigned_communes || [];
          const isSelf = this.currentUser && u.id === this.currentUser.id;

          return `
            <div class="p-4 sm:p-5 rounded-2xl bg-brand-cream border border-brand-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div class="flex items-start gap-3 min-w-0">
                <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl ${u.role === 'ADMIN' ? 'bg-brand-dark text-brand-light' : 'bg-brand-surface text-brand-text'} flex items-center justify-center font-extrabold text-sm flex-shrink-0 border border-brand-border">
                  ${u.name.substring(0,2).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="text-sm font-bold text-brand-text truncate">${u.name}</h4>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${u.role === 'ADMIN' ? 'bg-brand-dark text-brand-light' : 'bg-amber-100 text-amber-900 border border-amber-300'}">
                      ${u.role}
                    </span>
                    ${isSelf ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Vous</span>' : ''}
                  </div>
                  <div class="text-xs text-brand-muted mt-0.5 flex items-center gap-3 flex-wrap">
                    <span class="break-all">✉️ ${u.email}</span>
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

              <!-- ACTIONS RESPONSIVE -->
              <div class="flex items-center gap-2 flex-wrap border-t md:border-t-0 pt-3 md:pt-0 border-brand-border justify-start sm:justify-end">
                <button onclick="AdminApp.resetPassword('${u.id}', '${u.name}')" type="button" class="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-white border border-brand-border hover:bg-brand-surface text-brand-text text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 min-h-[38px]">
                  <span class="material-symbols-outlined text-[16px] text-amber-600">key</span>
                  <span>Réinit. mot de passe</span>
                </button>
                ${!isSelf ? `
                  <button onclick="AdminApp.toggleRole('${u.id}', '${u.role}')" type="button" class="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-white border border-brand-border hover:bg-brand-surface text-brand-text text-xs font-bold transition-all shadow-sm min-h-[38px]">
                    Passer en ${u.role === 'ADMIN' ? 'AGENT' : 'ADMIN'}
                  </button>
                  <button onclick="AdminApp.deleteUser('${u.id}', '${(u.name || '').replace(/'/g, "\\'")}', event.currentTarget)" type="button" class="p-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all flex items-center justify-center min-h-[38px] min-w-[38px]" title="Supprimer le membre">
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
          const res = await fetch(getApiUrl('create_user'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({
              name, email, role,
              assigned_communes: selectedCommunes,
              password: customPass
            })
          }).then(r => r.json());

          if (res.success) {
            document.getElementById('credEmail').textContent = res.user.email;
            document.getElementById('credPass').textContent = res.generated_password;
            document.getElementById('credentialsAlert').classList.remove('hidden');

            e.target.reset();
            this.renderCommunesCheckboxes();
            await this.loadUsers();
            this.showToast('Nouveau membre créé avec succès !');
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
        const text = `Identifiants Menu Scan :\n- Email : ${email}\n- Mot de passe : ${pass}\n- Lien de connexion : ${window.location.origin}/login.php`;

        navigator.clipboard.writeText(text).then(() => {
          this.showToast('Identifiants copiés dans le presse-papier !');
        });
      },

      async toggleCommune(userId, commune) {
        try {
          const res = await fetch(getApiUrl('toggle_user_commune'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
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
          const res = await fetch(getApiUrl('reset_user_password'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({ user_id: userId })
          }).then(r => r.json());

          if (res.success) {
            const user = this.users.find(u => u.id === userId);
            document.getElementById('credEmail').textContent = user ? user.email : '';
            document.getElementById('credPass').textContent = res.new_password;
            document.getElementById('credentialsAlert').classList.remove('hidden');
            this.showToast('Nouveau mot de passe généré !');
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
          const res = await fetch(getApiUrl('update_user_role'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({ user_id: userId, role: newRole })
          }).then(r => r.json());

          if (res.success) {
            await this.loadUsers();
            this.showToast(`Rôle mis à jour : ${newRole}`);
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
        if (btnElement.dataset.confirming !== 'true') {
          btnElement.dataset.confirming = 'true';
          const origClass = btnElement.className;
          const origHTML = btnElement.innerHTML;
          btnElement.className = 'px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1 animate-pulse min-h-[38px]';
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

        btnElement.dataset.confirming = 'false';
        btnElement.disabled = true;
        btnElement.style.opacity = '0.5';
        try {
          const res = await fetch(getApiUrl('delete_user'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
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
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      },

      pendingResetVisitsAdmin: false,

      async resetVisits(btnElement) {
        if (!this.pendingResetVisitsAdmin) {
          this.pendingResetVisitsAdmin = true;
          if (btnElement) {
            btnElement.className = "w-full sm:w-auto h-10 px-4 bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5 animate-pulse";
            btnElement.innerHTML = `<span class="material-symbols-outlined text-[16px]">warning</span><span>Confirmer la réinitialisation ?</span>`;
          }
          setTimeout(() => {
            this.pendingResetVisitsAdmin = false;
            if (btnElement) {
              btnElement.className = "w-full sm:w-auto h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5";
              btnElement.innerHTML = `<span class="material-symbols-outlined text-[16px]">delete_sweep</span><span>Réinitialiser toutes les visites</span>`;
            }
          }, 4000);
          return;
        }

        this.pendingResetVisitsAdmin = false;
        try {
          const res = await fetch(getApiUrl('reset_visits'), {
            method: 'POST',
            credentials: 'include'
          }).then(r => r.json());
          if (res.success) {
            await this.loadData();
            this.showToast('Toutes les visites ont été réinitialisées ✓');
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
