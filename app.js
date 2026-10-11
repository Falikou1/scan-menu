/**
 * FieldOps — Prospection Abidjan (Engine V3 Real Places & Google Maps Platform)
 */

const App = {
  state: {
    currentTab: 'accueil',
    selectedCommune: 'Cocody',
    selectedQuartier: 'Tous',
    selectedStatus: 'all',
    searchQuery: '',
    restaurants: [],
    stats: null,
    visits: [],
    currentUser: null,
    teamPerformances: [],
    activeRestaurant: null,
    activeVisit: null,
    timerInterval: null,
    timerSeconds: 0,
    reportResult: 'tres_interesse',
    reportAction: 'send_doc',
    mapInstance: null,
    mapClusterGroup: null,
    mapMarkers: [],
    desktopMapInstance: null,
    desktopMapMarkers: [],
    modalMiniMap: null,
    modalMiniMapMarker: null,
    userGpsLocation: null,
    googleMapsConfig: { has_key: false },
    // Carte advanced filters
    mapFilterCommune: 'all',
    mapFilterQuartier: 'all',
    mapFilterStatus: 'all',
    mapFilterAgent: 'all',
    mapFiltersOpen: false
  },

  async init() {
    this.bindEvents();
    this.initUserGeolocation();
    await this.checkAuth();
    await this.loadConfig();
    await this.loadData();
    this.renderCurrentTab();

    // Si redirection depuis admin.php (tentative d'accès non autorisé)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'required') {
      this.showToast('Accès restreint. Veuillez vous connecter avec un compte Administrateur.', 'warning');
      this.openAuthModal('login');
    }

    // Polling de synchronisation live toutes les 15 secondes
    setInterval(() => {
      this.loadData(true);
    }, 15000);
  },

  initUserGeolocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.state.userGpsLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          this.refreshActiveTabContent();
        },
        (err) => {
          console.log('Position GPS non autorisée ou non disponible');
          this.state.userGpsLocation = null;
        }
      );
    }
  },

  calculateRealDistance(lat, lng) {
    if (!this.state.userGpsLocation || !lat || !lng) {
      return 'Distance non disponible';
    }
    const uLat = this.state.userGpsLocation.lat;
    const uLng = this.state.userGpsLocation.lng;

    const R = 6371; // Rayon Terre km
    const dLat = (lat - uLat) * Math.PI / 180;
    const dLon = (lng - uLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(uLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const km = R * c;

    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1).replace('.', ',')} km`;
  },

  async loadConfig() {
    try {
      const res = await fetch('api.php?action=get_config').then(r => r.json());
      if (res.success && res.config) {
        this.state.googleMapsConfig = res.config;
      }
    } catch (e) {
      console.warn('Erreur chargement config Google Maps:', e);
    }
  },

  async checkAuth() {
    try {
      const res = await fetch('api.php?action=me').then(r => r.json());
      if (res.success && res.user) {
        this.state.currentUser = res.user;
      } else {
        this.state.currentUser = null;
      }
      this.updateUserUI();
    } catch (e) {
      console.warn('Erreur vérification session auth:', e);
      this.state.currentUser = null;
      this.updateUserUI();
    }
  },

  updateUserUI() {
    const user = this.state.currentUser;

    const sidebarGuestCard = document.getElementById('sidebarGuestCard');
    const sidebarUserCard = document.getElementById('sidebarUserCard');
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const headerUserProfile = document.getElementById('headerUserProfile');

    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserRole = document.getElementById('sidebarUserRole');
    const sidebarAvatarInitial = document.getElementById('sidebarAvatarInitial');

    const headerUserName = document.getElementById('headerUserName');
    const headerAvatarInitial = document.getElementById('headerAvatarInitial');
    const visitModalAvatar = document.getElementById('visitModalAvatar');
    const reportModalAvatar = document.getElementById('reportModalAvatar');
    const sidebarAdminNavItem = document.getElementById('sidebarAdminNavItem');

    if (user) {
      const initial = (user.name || 'U').charAt(0).toUpperCase();
      const roleTag = user.role === 'ADMIN' ? 'Boss / Admin' : 'Agent Commercial';

      if (sidebarGuestCard) sidebarGuestCard.classList.add('hidden');
      if (sidebarUserCard) sidebarUserCard.classList.remove('hidden');
      if (headerLoginBtn) headerLoginBtn.classList.add('hidden');
      if (headerUserProfile) headerUserProfile.classList.remove('hidden');

      if (sidebarUserName) sidebarUserName.textContent = user.name;
      if (sidebarUserRole) sidebarUserRole.textContent = roleTag;
      if (sidebarAvatarInitial) sidebarAvatarInitial.textContent = initial;

      if (headerUserName) headerUserName.textContent = user.name;
      if (headerAvatarInitial) headerAvatarInitial.textContent = initial;
      if (visitModalAvatar) visitModalAvatar.textContent = initial;
      if (reportModalAvatar) reportModalAvatar.textContent = initial;

      if (user.role === 'ADMIN') {
        if (sidebarAdminNavItem) sidebarAdminNavItem.classList.remove('hidden');
      } else {
        if (sidebarAdminNavItem) sidebarAdminNavItem.classList.add('hidden');
        if (this.state.currentTab === 'admin') this.navigateTo('accueil');
      }
    } else {
      if (sidebarGuestCard) sidebarGuestCard.classList.remove('hidden');
      if (sidebarUserCard) sidebarUserCard.classList.add('hidden');
      if (headerLoginBtn) headerLoginBtn.classList.remove('hidden');
      if (headerUserProfile) headerUserProfile.classList.add('hidden');

      if (sidebarUserName) sidebarUserName.textContent = 'Non connecté';
      if (sidebarUserRole) sidebarUserRole.textContent = 'Visiteur';
      if (sidebarAvatarInitial) sidebarAvatarInitial.textContent = '?';

      if (headerUserName) headerUserName.textContent = 'Se connecter';
      if (headerAvatarInitial) headerAvatarInitial.textContent = '?';
      if (visitModalAvatar) visitModalAvatar.textContent = '?';
      if (reportModalAvatar) reportModalAvatar.textContent = '?';

      if (sidebarAdminNavItem) sidebarAdminNavItem.classList.add('hidden');
      if (this.state.currentTab === 'admin') this.navigateTo('accueil');
    }
  },

  async loadData(silent = false) {
    try {
      const [statsRes, restRes, visitsRes] = await Promise.all([
        fetch('api.php?action=stats').then(r => r.json()),
        fetch('api.php?action=restaurants').then(r => r.json()),
        fetch('api.php?action=visits').then(r => r.json())
      ]);

      if (statsRes.success) {
        this.state.stats = statsRes.stats;
        this.state.teamPerformances = statsRes.stats.team_performances || [];
      }
      if (restRes.success) this.state.restaurants = restRes.restaurants;
      if (visitsRes.success) this.state.visits = visitsRes.visits;

      if (silent) {
        this.refreshActiveTabContent();
      }
    } catch (err) {
      if (!silent) console.error('Erreur chargement données:', err);
    }
  },

  refreshActiveTabContent() {
    if (this.state.currentTab === 'accueil') {
      this.renderAccueilMetrics();
      this.renderTeamPerformances();
      this.renderCommunesCards();
    } else if (this.state.currentTab === 'restaurants') {
      this.renderRestaurants();
    } else if (this.state.currentTab === 'carte') {
      this.updateMapMarkers();
    } else if (this.state.currentTab === 'tournee') {
      this.renderTournee();
    } else if (this.state.currentTab === 'historique') {
      this.renderHistorique();
    }
  },

  bindEvents() {
    document.querySelectorAll('[data-nav-target]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = el.getAttribute('data-nav-target');
        this.navigateTo(tab);
      });
    });

    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value.toLowerCase().trim();
        if (this.state.currentTab === 'accueil') {
          this.filterAccueilCommunes();
        } else if (this.state.currentTab === 'restaurants') {
          this.renderRestaurantsList();
          this.updateDesktopMapMarkers();
        }
      });
    }

    window.addEventListener('popstate', () => {
      this.closeModalViews();
    });

    window.addEventListener('resize', () => {
      if (this.state.mapInstance) this.state.mapInstance.invalidateSize();
      if (this.state.desktopMapInstance) this.state.desktopMapInstance.invalidateSize();
    });
  },

  navigateTo(tab, params = {}) {
    // Garde de sécurité : Seul un Administrateur authentifié peut accéder à l'onglet "admin"
    if (tab === 'admin') {
      if (!this.state.currentUser) {
        this.showToast('Connexion requise : Veuillez vous connecter avec un compte Administrateur.', 'warning');
        this.openAuthModal('login');
        return;
      }
      if (this.state.currentUser.role !== 'ADMIN') {
        this.showToast('Accès refusé : Cet espace est strictement réservé aux Administrateurs.', 'error');
        return;
      }
    }

    this.state.currentTab = tab;
    if (params.commune) this.state.selectedCommune = params.commune;
    if (params.quartier) this.state.selectedQuartier = params.quartier;
    if (params.status !== undefined) this.state.selectedStatus = params.status;

    document.querySelectorAll('[data-nav-target]').forEach(el => {
      const target = el.getAttribute('data-nav-target');
      const isDesktop = el.closest('aside') !== null;
      if (target === tab) {
        if (isDesktop) {
          el.classList.remove('text-[#D7CCC8]', 'hover:bg-white/10', 'hover:text-white');
          el.classList.add('bg-brand-light', 'text-white', 'font-semibold');
        } else {
          el.classList.remove('text-[#D7CCC8]', 'hover:text-white');
          el.classList.add('text-brand-light', 'font-bold');
        }
        el.setAttribute('aria-current', 'page');
      } else {
        if (isDesktop) {
          el.classList.remove('bg-brand-light', 'text-white', 'font-semibold');
          el.classList.add('text-[#D7CCC8]', 'hover:bg-white/10', 'hover:text-white');
        } else {
          el.classList.remove('text-brand-light', 'font-bold');
          el.classList.add('text-[#D7CCC8]', 'hover:text-white');
        }
        el.removeAttribute('aria-current');
      }
    });

    const headerSubtitle = document.getElementById('headerScreenSubtitle');
    if (headerSubtitle) {
      const titles = {
        accueil: 'Accueil',
        carte: 'Carte Interactive',
        restaurants: 'Restaurants',
        tournee: 'Tournée Optimisée',
        historique: 'Historique Visites',
        admin: 'Administration Équipe'
      };
      headerSubtitle.textContent = titles[tab] || 'Terrain';
    }

    document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
    const activeView = document.getElementById(`view-${tab}`);
    if (activeView) activeView.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.renderCurrentTab();
  },

  renderCurrentTab() {
    switch (this.state.currentTab) {
      case 'accueil':
        this.renderAccueil();
        break;
      case 'restaurants':
        this.renderRestaurants();
        break;
      case 'carte':
        this.renderCarte();
        break;
      case 'tournee':
        this.renderTournee();
        break;
      case 'historique':
        this.renderHistorique();
        break;
      case 'admin':
        this.renderAdminTab();
        break;
    }
  },

  // -------------------------------------------------------------
  // VUE 1 : ACCUEIL / DASHBOARD
  // -------------------------------------------------------------
  renderAccueil() {
    this.renderAccueilMetrics();
    this.renderTeamPerformances();
    this.renderCommunesCards();
  },

  renderAccueilMetrics() {
    const stats = this.state.stats;
    if (!stats) return;

    const kpiTotal = document.getElementById('kpiTotal');
    const kpiVisites = document.getElementById('kpiVisites');
    const kpiAVisiter = document.getElementById('kpiAVisiter');
    const kpiRelances = document.getElementById('kpiRelances');
    const kpiCoveragePct = document.getElementById('kpiCoveragePct');
    const campaignCounter = document.getElementById('campaignCounter');

    if (kpiTotal) kpiTotal.textContent = stats.total;
    if (kpiVisites) kpiVisites.textContent = stats.visites;
    if (kpiAVisiter) kpiAVisiter.textContent = stats.a_visiter;
    if (kpiRelances) kpiRelances.textContent = stats.a_relancer;
    if (kpiCoveragePct) kpiCoveragePct.textContent = `${stats.coverage_pct}%`;
    if (campaignCounter) campaignCounter.textContent = `${stats.visites} / ${stats.total} Visites`;

    const topBarV = document.getElementById('topBarVisites');
    const topBarR = document.getElementById('topBarRelances');
    const topBarA = document.getElementById('topBarAVisiter');
    if (topBarV) topBarV.style.width = `${stats.pct_visites}%`;
    if (topBarR) topBarR.style.width = `${stats.pct_relances}%`;
    if (topBarA) topBarA.style.width = `${stats.pct_a_visiter}%`;

    const bentoBarV = document.getElementById('bentoBarVisites');
    const bentoBarR = document.getElementById('bentoBarRelances');
    const bentoBarA = document.getElementById('bentoBarAVisiter');
    if (bentoBarV) bentoBarV.style.width = `${stats.pct_visites}%`;
    if (bentoBarR) bentoBarR.style.width = `${stats.pct_relances}%`;
    if (bentoBarA) bentoBarA.style.width = `${stats.pct_a_visiter}%`;

    const bentoLabelV = document.getElementById('bentoLabelVisites');
    const bentoLabelR = document.getElementById('bentoLabelRelances');
    const bentoLabelA = document.getElementById('bentoLabelAVisiter');
    if (bentoLabelV) bentoLabelV.textContent = `${stats.visites} visités (${stats.pct_visites}%)`;
    if (bentoLabelR) bentoLabelR.textContent = `${stats.a_relancer} relances (${stats.pct_relances}%)`;
    if (bentoLabelA) bentoLabelA.textContent = `${stats.a_visiter} vierges (${stats.pct_a_visiter}%)`;
  },

  renderTeamPerformances() {
    const grid = document.getElementById('teamPerformancesGrid');
    const badge = document.getElementById('teamCountBadge');
    if (!grid) return;

    const team = this.state.teamPerformances || [];
    if (badge) badge.textContent = `${team.length} Membre${team.length > 1 ? 's' : ''}`;

    if (team.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full p-4 rounded-xl bg-surface-container-low text-center text-xs text-on-surface-variant">
          Aucun membre n'a encore enregistré de compte. Les agents apparaîtront ici dès leur première inscription.
        </div>
      `;
      return;
    }

    grid.innerHTML = team.map(member => {
      const initial = (member.name || 'A').charAt(0).toUpperCase();
      const roleLabel = member.role === 'ADMIN' ? 'Boss / Admin' : 'Agent Commercial';
      return `
        <div class="bg-stone-50 p-3.5 rounded-xl border border-brand-border flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-full bg-brand-dark text-white font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
              ${initial}
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-bold text-brand-text truncate">${member.name}</span>
              <span class="text-[10px] text-stone-500 font-medium">${roleLabel}</span>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="text-sm font-extrabold text-brand-dark block">${member.visits_count}</span>
            <span class="text-[10px] font-semibold text-stone-500">Visites</span>
          </div>
        </div>
      `;
    }).join('');
  },

  renderCommunesCards() {
    const stats = this.state.stats;
    const container = document.getElementById('communesCardsContainer');
    if (!container || !stats) return;

    container.innerHTML = stats.communes.map(c => `
      <article class="commune-card bg-white rounded-2xl p-5 shadow-sm border border-brand-border flex flex-col gap-3 hover:shadow-md hover:border-brand-light transition-all cursor-pointer" onclick="App.selectCommune('${c.name}')">
        <div class="flex items-start justify-between gap-2">
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[20px] text-brand-light">location_on</span>
              <h3 class="text-base font-bold text-brand-text tracking-tight">${c.name}</h3>
            </div>
            <span class="text-xs text-stone-500 pl-6 mt-0.5">${c.desc}</span>
          </div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200 flex-shrink-0">
            <span class="w-2 h-2 rounded-full bg-stone-500"></span>
            <span class="text-[11px] font-bold tracking-wide uppercase">${c.a_visiter} À VISITER</span>
          </div>
        </div>
        <div class="flex items-center justify-between text-stone-500 text-xs pt-1">
          <span><strong class="text-brand-text font-semibold">${c.total}</strong> restaurants</span>
          <span>•</span>
          <span><strong class="text-emerald-700 font-semibold">${c.visites}</strong> visités</span>
          <span>•</span>
          <span class="font-semibold text-brand-dark">${c.coverage_pct}% couvert</span>
        </div>
        <div class="w-full bg-stone-100 rounded-full h-2 overflow-hidden border border-stone-200">
          <div class="bg-brand-dark h-2 rounded-full transition-all duration-500" style="width: ${c.coverage_pct}%"></div>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-brand-border">
          <span class="text-xs text-stone-500 flex items-center gap-1 font-medium">
            <span class="material-symbols-outlined text-[16px] text-brand-light">storefront</span> ${c.quartiers ? c.quartiers.length + ' zones réelles' : 'Zone prioritaire'}
          </span>
          <button class="h-9 px-4 rounded-xl bg-stone-100 text-brand-dark text-xs font-bold flex items-center gap-1 hover:bg-brand-dark hover:text-white transition-all border border-stone-200" type="button">
            <span>Explorer (${c.total})</span>
            <span class="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </article>
    `).join('');
  },

  selectCommune(communeName) {
    this.state.selectedCommune = communeName;
    this.state.selectedQuartier = 'Tous';

    // Synchroniser tous les sélecteurs et titres de commune
    const quickSelect = document.getElementById('communeQuickSelect');
    if (quickSelect) quickSelect.value = communeName;
    const tourneeSelect = document.getElementById('tourneeCommuneSelect');
    if (tourneeSelect) tourneeSelect.value = communeName;

    const restTitle = document.getElementById('restCommuneTitle');
    if (restTitle) restTitle.textContent = communeName;
    const tourneeTitle = document.getElementById('tourneeCommuneTitle');
    if (tourneeTitle) tourneeTitle.textContent = `Tournée Terrain ${communeName}`;

    if (this.state.currentTab === 'accueil') {
      this.navigateTo('tournee');
    } else {
      this.renderCurrentTab();
    }
  },

  filterAccueilCommunes() {
    const q = this.state.searchQuery;
    const cards = document.querySelectorAll('.commune-card');
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      if (text.includes(q)) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  },

  // -------------------------------------------------------------
  // VUE 2 : RESTAURANTS
  // -------------------------------------------------------------
  renderRestaurants() {
    const commune = this.state.selectedCommune;
    const communeRestaurants = this.state.restaurants.filter(r => r.commune.toLowerCase() === commune.toLowerCase());
    
    const countTotal = communeRestaurants.length;
    const countVisites = communeRestaurants.filter(r => r.status === 'VISITE').length;
    const countAVisiter = communeRestaurants.filter(r => r.status === 'A_VISITER').length;
    const countRelance = communeRestaurants.filter(r => r.status === 'A_RELANCER').length;
    const covPct = countTotal > 0 ? Math.round((countVisites / countTotal) * 100) : 0;

    const communeTitle = document.getElementById('restCommuneTitle');
    const quickSelect = document.getElementById('communeQuickSelect');
    if (quickSelect && quickSelect.value !== commune) quickSelect.value = commune;
    const restTotalTargets = document.getElementById('restTotalTargets');
    const restCoveragePct = document.getElementById('restCoveragePct');
    const restCoverageBar = document.getElementById('restCoverageBar');
    const restCountAVisiter = document.getElementById('restCountAVisiter');
    const restCountVisites = document.getElementById('restCountVisites');
    const restCountRelance = document.getElementById('restCountRelance');

    if (communeTitle) communeTitle.textContent = commune;
    if (restTotalTargets) restTotalTargets.textContent = countTotal;
    if (restCoveragePct) restCoveragePct.textContent = `${covPct}% Couvert`;
    if (restCoverageBar) restCoverageBar.style.width = `${covPct}%`;
    if (restCountAVisiter) restCountAVisiter.textContent = countAVisiter;
    if (restCountVisites) restCountVisites.textContent = countVisites;
    if (restCountRelance) restCountRelance.textContent = countRelance;

    const cStatsObj = {
      total: countTotal,
      visites: countVisites,
      a_visiter: countAVisiter,
      a_relancer: countRelance
    };

    const communeMeta = this.state.stats?.communes.find(c => c.name.toLowerCase() === commune.toLowerCase());
    this.renderQuartierPills(communeMeta?.quartiers || []);
    this.renderStatusPills(cStatsObj);
    this.renderRestaurantsList();
    
    // Destroy and reinit desktop map on commune change (ensures fresh OSM tiles)
    if (this.state.desktopMapInstance) {
      this.state.desktopMapInstance.remove();
      this.state.desktopMapInstance = null;
      this.state.desktopMapMarkers = [];
    }
    this.initDesktopMap();
    this.updateDesktopMapMarkers();
  },

  renderQuartierPills(quartiers) {
    const container = document.getElementById('quartierPillsContainer');
    if (!container) return;

    const allQuartiers = ['Tous', ...quartiers];
    container.innerHTML = allQuartiers.map(q => {
      const active = this.state.selectedQuartier === q;
      return `
        <button class="h-9 flex-shrink-0 px-4 rounded-full text-xs font-semibold transition-all shadow-sm ${
          active 
            ? 'bg-brand-dark text-white font-bold ring-2 ring-brand-light' 
            : 'bg-white text-brand-text hover:bg-stone-100 border border-brand-border'
        }" onclick="App.selectQuartier('${q}')" type="button">
          ${q}
        </button>
      `;
    }).join('');
  },

  selectQuartier(q) {
    this.state.selectedQuartier = q;
    const cMeta = this.state.stats?.communes.find(c => c.name.toLowerCase() === this.state.selectedCommune.toLowerCase());
    this.renderQuartierPills(cMeta?.quartiers || []);
    this.renderRestaurantsList();
    this.updateDesktopMapMarkers();
  },

  renderStatusPills(cStats) {
    const container = document.getElementById('statusPillsContainer');
    if (!container) return;

    const currentStatus = this.state.selectedStatus;
    const filterOptions = [
      { key: 'all', label: `Tous (${cStats.total})`, icon: 'format_list_bulleted' },
      { key: 'A_VISITER', label: `À visiter (${cStats.a_visiter})`, dot: 'bg-stone-500' },
      { key: 'VISITE', label: `Visité (${cStats.visites})`, dot: 'bg-emerald-600' },
      { key: 'A_RELANCER', label: `À rappeler (${cStats.a_relancer})`, dot: 'bg-amber-600' },
      { key: 'proximity', label: 'GPS Proche', icon: 'near_me' }
    ];

    container.innerHTML = filterOptions.map(opt => {
      const isSelected = currentStatus === opt.key;
      return `
        <button class="h-10 flex-shrink-0 px-4 rounded-full text-xs flex items-center gap-2 shadow-sm transition-all ${
          isSelected 
            ? 'bg-brand-dark text-white font-bold ring-2 ring-brand-light'
            : 'bg-white text-brand-text hover:bg-stone-100 border border-brand-border'
        }" onclick="App.selectStatusFilter('${opt.key}')" type="button">
          ${opt.dot ? `<span class="w-2.5 h-2.5 rounded-full ${opt.dot}"></span>` : ''}
          ${opt.icon ? `<span class="material-symbols-outlined text-[18px]">${opt.icon}</span>` : ''}
          <span>${opt.label}</span>
          ${isSelected ? '<span class="material-symbols-outlined text-[16px]">check</span>' : ''}
        </button>
      `;
    }).join('');
  },

  selectStatusFilter(statusKey) {
    this.state.selectedStatus = statusKey;
    this.renderRestaurants();
  },

  getFilteredRestaurants() {
    let items = this.state.restaurants.filter(r => r.commune.toLowerCase() === this.state.selectedCommune.toLowerCase());

    if (this.state.selectedQuartier !== 'Tous') {
      const normalize = str => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const qNorm = normalize(this.state.selectedQuartier);
      items = items.filter(r => {
        const zNorm = normalize(r.zone);
        const qValNorm = normalize(r.quartier);
        return zNorm === qNorm || qValNorm === qNorm || zNorm.includes(qNorm) || qValNorm.includes(qNorm) || qNorm.includes(zNorm);
      });
    }

    if (this.state.selectedStatus !== 'all' && this.state.selectedStatus !== 'proximity') {
      items = items.filter(r => r.status === this.state.selectedStatus);
    } else if (this.state.selectedStatus === 'proximity') {
      if (this.state.userGpsLocation) {
        items = items.filter(r => {
          const dist = this.calculateRealDistance(r.latitude, r.longitude);
          return dist.includes('m') || (dist.includes('km') && parseFloat(dist) <= 2.0);
        });
      }
    }

    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase().trim();
      items = items.filter(r => 
        (r.name && r.name.toLowerCase().includes(query)) ||
        (r.address && r.address.toLowerCase().includes(query)) ||
        (r.cuisine && r.cuisine.toLowerCase().includes(query)) ||
        (r.zone && r.zone.toLowerCase().includes(query)) ||
        (r.quartier && r.quartier.toLowerCase().includes(query)) ||
        (r.phone && r.phone.toLowerCase().includes(query))
      );
    }
    return items;
  },

  renderRestaurantsList() {
    const container = document.getElementById('restaurantsCardsContainer');
    if (!container) return;

    const items = this.getFilteredRestaurants();

    if (items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-surface-container-lowest rounded-2xl p-8 text-center flex flex-col items-center gap-3 shadow-sm border border-surface-container my-4">
          <span class="material-symbols-outlined text-[40px] text-outline">search_off</span>
          <span class="text-base font-bold text-on-surface">Aucun restaurant réel trouvé</span>
          <p class="text-xs text-on-surface-variant max-w-xs">
            Aucun établissement ne correspond à ces critères dans ${this.state.selectedCommune}.
          </p>
          <button class="h-9 px-4 rounded-xl bg-secondary text-on-secondary text-xs font-bold mt-2 hover:bg-secondary-container transition-colors" onclick="App.syncCommunePlaces()">
            Synchroniser via Google Places
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(r => this.generateRestaurantCardHTML(r)).join('');
  },

  generateRestaurantCardHTML(r) {
    const statusBadges = {
      A_VISITER: `
        <div class="bg-stone-100 text-stone-700 border border-stone-300 text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-bold">
          <span class="w-2 h-2 rounded-full bg-stone-500"></span>
          <span class="tracking-wide uppercase">À VISITER</span>
        </div>`,
      VISITE: `
        <div class="bg-emerald-50 text-emerald-700 border border-emerald-300 text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-bold">
          <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
          <span class="tracking-wide uppercase">VISITÉ</span>
        </div>`,
      A_RELANCER: `
        <div class="bg-amber-50 text-amber-700 border border-amber-300 text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-bold">
          <span class="w-2 h-2 rounded-full bg-amber-600"></span>
          <span class="tracking-wide uppercase">À RAPPELER</span>
        </div>`,
      REFUS: `
        <div class="bg-rose-50 text-rose-700 border border-rose-300 text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-bold">
          <span class="w-2 h-2 rounded-full bg-rose-600"></span>
          <span class="tracking-wide uppercase">REFUS</span>
        </div>`,
      A_VERIFIER: `
        <div class="bg-stone-100 text-stone-600 border border-stone-200 text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-bold">
          <span class="w-2 h-2 rounded-full bg-stone-400"></span>
          <span class="tracking-wide uppercase">À VÉRIFIER</span>
        </div>`
    };

    const realDist = this.calculateRealDistance(r.latitude, r.longitude);
    const photoSrc = r.photo || 'assets/restaurant_placeholder.svg';
    const phoneDisplay = r.phone || 'Non renseigné';

    return `
      <article class="bg-white rounded-2xl shadow-sm hover:shadow-md border border-brand-border overflow-hidden flex flex-col transition-all" data-restaurant-id="${r.id}">
        <div class="p-4 sm:p-5 flex flex-col justify-between h-full">
          <div>
            <div class="flex items-center justify-between mb-3">
              ${statusBadges[r.status] || statusBadges.A_VISITER}
              <div class="flex items-center gap-1 text-stone-500 text-[11px] font-bold bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200">
                <span class="material-symbols-outlined text-[15px] text-brand-light">navigation</span>
                <span class="text-brand-text">${realDist}</span>
              </div>
            </div>
            <div class="flex gap-3 items-start mb-3">
              <img class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0 bg-stone-100 shadow-inner border border-stone-200" src="${photoSrc}" alt="${r.name}" onerror="this.src='assets/restaurant_placeholder.svg'"/>
              <div class="flex flex-col min-w-0 flex-1">
                <h3 class="text-base font-bold text-brand-text truncate">${r.name}</h3>
                <p class="text-xs text-stone-500 flex items-center gap-1 mt-0.5 truncate">
                  <span class="material-symbols-outlined text-[15px] flex-shrink-0 text-brand-light">place</span>
                  <span class="truncate">${r.address}</span>
                </p>
                <div class="flex items-center gap-1 mt-1 text-brand-light text-[11px] font-semibold truncate">
                  <span class="material-symbols-outlined text-[15px]">restaurant</span>
                  <span class="truncate">${r.cuisine || 'Cuisine variée'}</span>
                </div>
                <div class="flex items-center justify-between mt-1 text-[11px] text-stone-400">
                  <span class="flex items-center gap-0.5 truncate">
                    <span class="material-symbols-outlined text-[14px]">near_me</span>
                    <span>${r.zone || r.commune}</span>
                  </span>
                  ${r.source ? `<span class="px-1.5 py-0.5 rounded bg-stone-100 text-[10px] text-stone-500 font-medium flex-shrink-0">${r.source}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="bg-stone-50 rounded-xl p-2.5 flex items-center justify-between mb-4 border border-brand-border">
              <div class="flex items-center gap-2 min-w-0">
                <span class="material-symbols-outlined text-[18px] text-brand-light">call</span>
                <span class="text-xs font-bold text-brand-text truncate">${phoneDisplay}</span>
              </div>
              ${r.phone ? `<a class="h-8 px-3 bg-stone-100 text-brand-dark hover:bg-brand-dark hover:text-white rounded-lg flex items-center gap-1 text-[11px] font-bold transition-colors border border-stone-200" href="tel:${r.phone}"><span>Appeler</span></a>` : '<span class="text-[11px] text-stone-400 italic">Non renseigné</span>'}
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <button class="h-11 bg-stone-100 hover:bg-stone-200 text-brand-text border border-stone-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors" onclick="App.openRestaurantDetail('${r.id}')" type="button" title="Voir la fiche détaillée">
              <span class="material-symbols-outlined text-[17px]">visibility</span>
              <span>Fiche</span>
            </button>
            <button class="h-11 ${r.status !== 'A_VISITER' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-stone-50 text-stone-500 border-stone-200'} border rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors" onclick="App.openRestaurantVisitsModal('${r.id}')" type="button" title="Voir les comptes-rendus de l'équipe">
              <span class="material-symbols-outlined text-[17px] ${r.status !== 'A_VISITER' ? 'text-emerald-600' : 'text-stone-400'}">history_edu</span>
              <span>Rapport</span>
            </button>
            <button class="h-11 bg-brand-dark text-white hover:bg-brand-dark/90 rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95" onclick="App.startFieldVisit('${r.id}')" type="button">
              <span class="material-symbols-outlined text-[17px] text-brand-light" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
              <span>${r.status !== 'A_VISITER' ? 'Re-visiter' : 'Visiter'}</span>
            </button>
          </div>
        </div>
      </article>
    `;
  },

  initDesktopMap() {
    const mapEl = document.getElementById('desktopRestaurantsMap');
    if (!mapEl || this.state.desktopMapInstance) return;

    try {
      const defaultCenter = [5.36, -3.98];
      const map = L.map('desktopRestaurantsMap', {
        zoomControl: true,
        attributionControl: true
      }).setView(defaultCenter, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
      }).addTo(map);

      this.state.desktopMapInstance = map;
      setTimeout(() => map.invalidateSize(), 300);
    } catch (e) {
      console.warn('Carte Desktop non disponible', e);
    }
  },

  updateDesktopMapMarkers() {
    if (!this.state.desktopMapInstance) return;

    if (this.state.desktopMapMarkers) {
      this.state.desktopMapMarkers.forEach(m => this.state.desktopMapInstance.removeLayer(m));
    }
    this.state.desktopMapMarkers = [];

    const items = this.getFilteredRestaurants();
    const bounds = [];

    items.forEach(r => {
      // Only place markers for restaurants with real coordinates
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (!lat || !lng || r.geocode_status === 'non_localise') return;

      bounds.push([lat, lng]);

      const cfg = this.getStatusConfig(r.status);

      const customIcon = L.divIcon({
        className: '',
        html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer">
          <div style="width:30px;height:30px;border-radius:50%;background:${cfg.color};color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.3);border:2.5px solid #fff">
            <span class="material-symbols-outlined" style="font-size:15px;color:#fff">${cfg.icon}</span>
          </div>
          <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${cfg.color};margin-top:-1px"></div>
        </div>`,
        iconSize: [30, 37],
        iconAnchor: [15, 37]
      });

      const popupHtml = `
        <div style="font-family:Inter,sans-serif;min-width:160px">
          <div style="font-weight:700;font-size:12px;color:#2B1D17;margin-bottom:3px">${r.name}</div>
          <div style="font-size:11px;color:#75625A;margin-bottom:6px">${r.zone || r.commune}</div>
          <button onclick="App.openRestaurantDetail('${r.id}')" style="width:100%;padding:5px;background:#4E342E;color:#fff;border:none;border-radius:7px;font-size:10px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">Voir la fiche</button>
        </div>`;

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(this.state.desktopMapInstance);
      marker.bindPopup(popupHtml, { maxWidth: 200, className: 'menuscan-popup' });
      this.state.desktopMapMarkers.push(marker);
    });

    if (bounds.length > 1) {
      this.state.desktopMapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    } else if (bounds.length === 1) {
      this.state.desktopMapInstance.setView(bounds[0], 15);
    }
    setTimeout(() => this.state.desktopMapInstance.invalidateSize(), 200);
  },

  // -------------------------------------------------------------
  // VUE 3 : CARTE INTERACTIVE
  // -------------------------------------------------------------
  renderCarte() {
    this.populateMapFilters();
    this.initMap();
    this.updateMapMarkers();
  },

  populateMapFilters() {
    // Populate commune select
    const communeSel = document.getElementById('mapFilterCommuneSelect');
    if (communeSel && this.state.stats) {
      const communes = this.state.stats.communes.map(c => c.name);
      const currentVal = communeSel.value;
      communeSel.innerHTML = '<option value="all">Toutes les communes</option>' +
        communes.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join('');
    }

    // Populate quartier select based on commune
    this.updateMapQuartierOptions();

    // Populate agent select
    const agentSel = document.getElementById('mapFilterAgentSelect');
    if (agentSel && this.state.stats) {
      const agents = [...new Set(this.state.restaurants.map(r => r.agent).filter(Boolean))];
      const currentVal = agentSel.value;
      agentSel.innerHTML = '<option value="all">Tous les agents</option>' +
        agents.map(a => `<option value="${a}" ${a === currentVal ? 'selected' : ''}>${a}</option>`).join('');
    }
  },

  updateMapQuartierOptions() {
    const quartierSel = document.getElementById('mapFilterQuartierSelect');
    if (!quartierSel) return;
    const commune = this.state.mapFilterCommune;
    let quartiers = [];
    if (commune !== 'all' && this.state.stats) {
      const communeMeta = this.state.stats.communes.find(c => c.name === commune);
      quartiers = communeMeta ? (communeMeta.quartiers || []) : [];
    } else {
      quartiers = [...new Set(this.state.restaurants.map(r => r.zone || r.quartier).filter(Boolean))];
    }
    quartierSel.innerHTML = '<option value="all">Tous les quartiers</option>' +
      quartiers.map(q => `<option value="${q}">${q}</option>`).join('');
  },

  handleMapFilterChange() {
    const communeSel = document.getElementById('mapFilterCommuneSelect');
    const quartierSel = document.getElementById('mapFilterQuartierSelect');
    const statusSel = document.getElementById('mapFilterStatusSelect');
    const agentSel = document.getElementById('mapFilterAgentSelect');

    if (communeSel) this.state.mapFilterCommune = communeSel.value;
    if (quartierSel) this.state.mapFilterQuartier = quartierSel.value;
    if (statusSel) this.state.mapFilterStatus = statusSel.value;
    if (agentSel) this.state.mapFilterAgent = agentSel.value;

    if (communeSel && communeSel.value !== this.state.mapFilterCommune) {
      this.updateMapQuartierOptions();
    }

    this.updateMapMarkers();
  },

  getMapFilteredRestaurants() {
    let items = this.state.restaurants;

    // Role-based: AGENT sees only their communes
    if (this.state.currentUser && this.state.currentUser.role === 'AGENT') {
      const assigned = this.state.currentUser.assigned_communes || [];
      if (assigned.length > 0) {
        items = items.filter(r => assigned.includes(r.commune));
      }
    }

    if (this.state.mapFilterCommune !== 'all') {
      items = items.filter(r => r.commune === this.state.mapFilterCommune);
    }
    if (this.state.mapFilterQuartier !== 'all') {
      const normalize = str => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const qNorm = normalize(this.state.mapFilterQuartier);
      items = items.filter(r => normalize(r.zone) === qNorm || normalize(r.quartier) === qNorm);
    }
    if (this.state.mapFilterStatus !== 'all') {
      items = items.filter(r => r.status === this.state.mapFilterStatus);
    }
    if (this.state.mapFilterAgent !== 'all') {
      items = items.filter(r => r.agent === this.state.mapFilterAgent);
    }

    return items;
  },

  initMap() {
    const mapEl = document.getElementById('mapContainer');
    if (!mapEl || this.state.mapInstance) {
      if (this.state.mapInstance) {
        setTimeout(() => this.state.mapInstance.invalidateSize(), 200);
      }
      return;
    }

    try {
      const defaultCenter = [5.36, -3.98];
      const map = L.map('mapContainer', {
        zoomControl: false,
        attributionControl: true
      }).setView(defaultCenter, 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      // MarkerCluster group
      this.state.mapClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `<div class="map-cluster-icon">${count}</div>`,
            className: '',
            iconSize: [40, 40]
          });
        }
      });
      map.addLayer(this.state.mapClusterGroup);

      if (this.state.userGpsLocation) {
        const userIcon = L.divIcon({
          className: '',
          html: `<div style="width:32px;height:32px;position:relative;display:flex;align-items:center;justify-content:center">
            <span style="position:absolute;inset:0;border-radius:50%;background:rgba(161,120,63,0.3);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></span>
            <div style="width:22px;height:22px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.25);ring:2px solid #A1783F">
              <div style="width:14px;height:14px;border-radius:50%;background:#A1783F"></div>
            </div>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        L.marker([this.state.userGpsLocation.lat, this.state.userGpsLocation.lng], { icon: userIcon })
          .addTo(map).bindPopup('<b>Votre position terrain actuelle</b>');
      }

      this.state.mapInstance = map;

      const recenterBtn = document.getElementById('recenterBtn');
      if (recenterBtn) {
        recenterBtn.addEventListener('click', () => this.recenterMap());
      }
      setTimeout(() => map.invalidateSize(), 300);
    } catch (e) {
      console.warn('Leaflet non disponible', e);
    }
  },

  recenterMap() {
    if (!this.state.mapInstance) return;
    if (this.state.userGpsLocation) {
      this.state.mapInstance.setView([this.state.userGpsLocation.lat, this.state.userGpsLocation.lng], 15);
      this.showToast('Position GPS actualisée avec succès', 'success');
    } else {
      this.initUserGeolocation();
      this.state.mapInstance.setView([5.36, -3.98], 12);
      this.showToast('Centré sur Abidjan', 'info');
    }
  },

  getStatusConfig(status) {
    const configs = {
      VISITE:    { color: '#16A34A', icon: 'check',      label: 'VISITÉ' },
      A_RELANCER:{ color: '#EA580C', icon: 'schedule',  label: 'À RAPPELER' },
      REFUS:     { color: '#DC2626', icon: 'close',      label: 'REFUS' },
      INTERESSE: { color: '#A1783F', icon: 'thumb_up',  label: 'INTÉRESSÉ' },
      A_VISITER: { color: '#6B7280', icon: 'restaurant',label: 'À VISITER' }
    };
    return configs[status] || configs.A_VISITER;
  },

  updateMapMarkers() {
    if (!this.state.mapInstance || !this.state.mapClusterGroup) return;

    this.state.mapClusterGroup.clearLayers();
    this.state.mapMarkers = [];

    const allItems = this.getMapFilteredRestaurants();
    const localised = allItems.filter(r => r.latitude && r.longitude && r.geocode_status !== 'non_localise');
    const nonLocalised = allItems.filter(r => !r.latitude || !r.longitude || r.geocode_status === 'non_localise');

    // Update counters
    const counterVisible = document.getElementById('mapCounterVisible');
    const counterUnlocalized = document.getElementById('mapCounterUnlocalized');
    if (counterVisible) counterVisible.textContent = localised.length;
    if (counterUnlocalized) counterUnlocalized.textContent = nonLocalised.length;

    const bounds = [];

    localised.forEach(r => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (!lat || !lng) return;

      const cfg = this.getStatusConfig(r.status);

      const customIcon = L.divIcon({
        className: '',
        html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer">
          <div style="width:34px;height:34px;border-radius:50%;background:${cfg.color};color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.3);border:2.5px solid #fff">
            <span class="material-symbols-outlined" style="font-size:17px;color:#fff">${cfg.icon}</span>
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${cfg.color};margin-top:-1px"></div>
        </div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 42]
      });

      const statusBadgeHtml = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;background:${cfg.color}20;color:${cfg.color};font-size:10px;font-weight:700;border:1px solid ${cfg.color}40">
        <span style="width:7px;height:7px;border-radius:50%;background:${cfg.color};display:inline-block"></span>${cfg.label}
      </span>`;

      const popupHtml = `
        <div style="font-family:Inter,sans-serif;min-width:200px;max-width:260px">
          <div style="font-weight:700;font-size:13px;color:#2B1D17;margin-bottom:4px">${r.name}</div>
          ${statusBadgeHtml}
          <div style="font-size:11px;color:#75625A;margin:6px 0 2px;display:flex;align-items:center;gap:3px">
            <span class="material-symbols-outlined" style="font-size:13px;color:#A1783F">location_on</span>
            ${r.zone || r.commune}, ${r.address || ''}
          </div>
          ${r.phone ? `<div style="font-size:11px;margin:2px 0">
            <a href="tel:${r.phone}" style="color:#4E342E;font-weight:700;text-decoration:none;display:flex;align-items:center;gap:3px">
              <span class="material-symbols-outlined" style="font-size:13px;color:#A1783F">call</span> ${r.phone}
            </a>
          </div>` : ''}
          <div style="display:flex;gap:6px;margin-top:8px">
            <button onclick="App.openRestaurantDetail('${r.id}')" style="flex:1;padding:6px;background:#4E342E;color:#fff;border:none;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif">Voir la fiche</button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="flex:1;padding:6px;background:#FAF6F1;color:#4E342E;border:1px solid #E8DDD3;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:3px;font-family:Inter,sans-serif">
              <span class="material-symbols-outlined" style="font-size:12px">turn_right</span>Itinéraire
            </a>
          </div>
        </div>`;

      const marker = L.marker([lat, lng], { icon: customIcon });
      marker.bindPopup(popupHtml, { maxWidth: 270, className: 'menuscan-popup' });
      this.state.mapClusterGroup.addLayer(marker);
      this.state.mapMarkers.push(marker);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 1) {
      this.state.mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (bounds.length === 1) {
      this.state.mapInstance.setView(bounds[0], 15);
    }
  },

  selectRestaurantOnMap(restaurantId) {
    const restaurant = this.state.restaurants.find(r => r.id === restaurantId || r.google_place_id === restaurantId);
    if (!restaurant) return;

    this.state.activeRestaurant = restaurant;

    const sheetTitle = document.getElementById('sheetTitle');
    const sheetAddress = document.getElementById('sheetAddress');
    const sheetDistance = document.getElementById('sheetDistance');
    const sheetHours = document.getElementById('sheetHours');
    const sheetCuisine = document.getElementById('sheetCuisine');
    const sheetContactName = document.getElementById('sheetContactName');
    const sheetContactRole = document.getElementById('sheetContactRole');
    const sheetCallBtn = document.getElementById('sheetCallBtn');
    const sheetBadge = document.getElementById('sheetStatusBadge');
    const sheetStartBtn = document.getElementById('sheetStartBtn');
    const sheetRouteBtn = document.getElementById('sheetRouteBtn');

    if (sheetTitle) sheetTitle.textContent = restaurant.name;
    if (sheetAddress) sheetAddress.textContent = `${restaurant.commune} ${restaurant.zone || ''}, ${restaurant.address}`;
    if (sheetDistance) sheetDistance.textContent = this.calculateRealDistance(restaurant.latitude, restaurant.longitude);
    if (sheetHours) sheetHours.textContent = restaurant.opening_hours || 'Non renseigné';
    if (sheetCuisine) sheetCuisine.textContent = restaurant.cuisine || 'Non renseigné';

    const dm = restaurant.decision_maker || {};
    if (sheetContactName) sheetContactName.textContent = dm.name || 'Gérant / Contact';
    if (sheetContactRole) sheetContactRole.textContent = dm.role || 'Décisionnaire';
    if (sheetCallBtn) {
      if (restaurant.phone || dm.phone) {
        sheetCallBtn.href = `tel:${dm.phone || restaurant.phone}`;
        sheetCallBtn.classList.remove('pointer-events-none', 'opacity-40');
      } else {
        sheetCallBtn.removeAttribute('href');
        sheetCallBtn.classList.add('pointer-events-none', 'opacity-40');
      }
    }

    if (sheetBadge) {
      if (restaurant.status === 'VISITE') {
        sheetBadge.className = 'inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-[11px] font-bold';
        sheetBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-600"></span> VISITÉ';
      } else if (restaurant.status === 'A_RELANCER') {
        sheetBadge.className = 'inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 text-[11px] font-bold';
        sheetBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-600"></span> À RAPPELER';
      } else if (restaurant.status === 'REFUS') {
        sheetBadge.className = 'inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300 text-[11px] font-bold';
        sheetBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-600"></span> REFUS';
      } else {
        sheetBadge.className = 'inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-300 text-[11px] font-bold';
        sheetBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-stone-500"></span> À VISITER';
      }
    }

    if (sheetStartBtn) {
      sheetStartBtn.onclick = () => this.startFieldVisit(restaurant.id);
    }
    if (sheetRouteBtn) {
      sheetRouteBtn.onclick = () => this.openGoogleMapsRoute(restaurant);
    }

    const bottomSheet = document.getElementById('bottomSheet');
    if (bottomSheet && window.innerWidth < 1024) {
      bottomSheet.style.transform = 'translateY(0)';
    }
  },

  openGoogleMapsRoute(restaurant) {
    const lat = restaurant.latitude;
    const lng = restaurant.longitude;
    if (!lat || !lng) {
      this.showToast('Position non renseignée pour ce restaurant', 'info');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  },

  // -------------------------------------------------------------
  // GÉOCODAGE UNITAIRE & BATCH
  // -------------------------------------------------------------
  async geocodeRestaurant(restaurantId) {
    try {
      const res = await fetch('api.php?action=geocode_restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Fix: API expects 'id', not 'restaurant_id'
        body: JSON.stringify({ id: restaurantId })
      }).then(r => r.json());

      if (res.success && res.restaurant) {
        await this.loadData(true);
        const r = res.restaurant;
        this.showToast(`Position trouvée: ${parseFloat(r.latitude).toFixed(4)}, ${parseFloat(r.longitude).toFixed(4)}`, 'success');
        return { lat: r.latitude, lng: r.longitude };
      } else {
        this.showToast(res.error || 'Position non trouvée via Nominatim', 'info');
        return null;
      }
    } catch (e) {
      console.error('Geocode error:', e);
      return null;
    }
  },

  async openBatchGeocodeModal() {
    const modal = document.getElementById('batchGeocodeModal');
    if (!modal) return;

    const nonLocalises = this.state.restaurants.filter(
      r => !r.latitude || !r.longitude || r.geocode_status === 'non_localise'
    );

    const countEl = document.getElementById('batchGeocodeCount');
    if (countEl) countEl.textContent = nonLocalises.length;

    const progressBar = document.getElementById('batchGeocodeBar');
    const progressText = document.getElementById('batchGeocodeText');
    const resultEl = document.getElementById('batchGeocodeResult');
    const startBtn = document.getElementById('batchGeocodeStartBtn');

    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Prêt à démarrer';
    if (resultEl) resultEl.textContent = '';
    if (startBtn) startBtn.disabled = false;

    modal.classList.remove('hidden');
  },

  closeBatchGeocodeModal() {
    const modal = document.getElementById('batchGeocodeModal');
    if (modal) modal.classList.add('hidden');
  },

  async runBatchGeocode() {
    const startBtn = document.getElementById('batchGeocodeStartBtn');
    const progressBar = document.getElementById('batchGeocodeBar');
    const progressText = document.getElementById('batchGeocodeText');
    const resultEl = document.getElementById('batchGeocodeResult');

    if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'En cours...'; }

    const nonLocalises = this.state.restaurants.filter(
      r => !r.latitude || !r.longitude || r.geocode_status === 'non_localise'
    );
    const total = nonLocalises.length;
    if (total === 0) {
      if (progressText) progressText.textContent = 'Tous les restaurants sont déjà localisés !';
      if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Démarrer'; }
      return;
    }

    let done = 0;
    let successCount = 0;
    const batchSize = 20;

    const processBatch = async () => {
      const remaining = total - done;
      if (remaining <= 0) {
        if (progressText) progressText.textContent = `Terminé ! ${successCount} localisés sur ${total}`;
        if (resultEl) resultEl.innerHTML = `<span class="text-emerald-600 font-bold">✓ ${successCount} localisés</span> • ${total - successCount} non trouvés`;
        if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Démarrer'; }
        await this.loadData();
        if (this.state.currentTab === 'carte') this.updateMapMarkers();
        return;
      }

      if (progressText) progressText.textContent = `Traitement... ${done}/${total} (attente 1s/requête)`;

      try {
        const res = await fetch('api.php?action=geocode_batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size: batchSize })
        }).then(r => r.json());

        if (res.success) {
          done += res.processed;
          successCount += res.newly_geocoded || 0;
          const pct = Math.round((done / total) * 100);
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (progressText) progressText.textContent = `${done}/${total} traités — ${successCount} localisés`;

          if (res.remaining > 0) {
            setTimeout(processBatch, 500);
          } else {
            done = total;
            const finalPct = 100;
            if (progressBar) progressBar.style.width = `${finalPct}%`;
            if (progressText) progressText.textContent = `Terminé ! ${successCount} localisés sur ${total}`;
            if (resultEl) resultEl.innerHTML = `<span class="text-emerald-600 font-bold">✓ ${successCount} localisés</span> • ${total - successCount} non trouvés`;
            if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Démarrer'; }
            await this.loadData();
            if (this.state.currentTab === 'carte') this.updateMapMarkers();
          }
        } else {
          if (progressText) progressText.textContent = 'Erreur: ' + (res.error || 'Inconnue');
          if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Réessayer'; }
        }
      } catch (e) {
        if (progressText) progressText.textContent = 'Erreur réseau';
        if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Réessayer'; }
      }
    };

    processBatch();
  },

  async syncCommunePlaces() {
    const commune = this.state.selectedCommune;
    this.showToast(`Synchronisation Google Places pour ${commune} en cours...`, 'info');

    try {
      const res = await fetch('api.php?action=sync_commune_places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commune })
      }).then(r => r.json());

      if (res.success) {
        await this.loadData();
        this.showToast(`Google Places sync réussi: ${res.imported} créés, ${res.updated} mis à jour.`, 'success');
      } else {
        if (res.error && res.error.includes('non configurée')) {
          this.openConfigModal();
          this.showToast(res.error, 'info');
        } else {
          alert('Erreur synchronisation Google Places: ' + res.error);
        }
      }
    } catch (e) {
      console.error(e);
      alert('Erreur réseau lors de la synchronisation Places API');
    }
  },

  // -------------------------------------------------------------
  // VUE 4 : TOURNÉE DE PROSPECTION
  // -------------------------------------------------------------
  renderTournee() {
    const container = document.getElementById('tourneeListContainer');
    if (!container) return;

    const commune = this.state.selectedCommune;
    const tourneeTitle = document.getElementById('tourneeCommuneTitle');
    if (tourneeTitle) tourneeTitle.textContent = `Tournée Terrain ${commune}`;

    const tourneeSelect = document.getElementById('tourneeCommuneSelect');
    if (tourneeSelect && tourneeSelect.value !== commune) tourneeSelect.value = commune;

    let restaurantsInCommune = this.state.restaurants.filter(r => r.commune.toLowerCase() === commune.toLowerCase());
    
    // Trier : les 'A_VISITER' en premier (triés par distance GPS), puis les déjà visités
    let unvisited = restaurantsInCommune.filter(r => r.status === 'A_VISITER');
    let visited = restaurantsInCommune.filter(r => r.status !== 'A_VISITER');

    if (this.state.userGpsLocation) {
      unvisited = unvisited.sort((a, b) => this._haversineKm(a.latitude, a.longitude) - this._haversineKm(b.latitude, b.longitude));
    }

    const targets = [...unvisited, ...visited];

    const tourneeTotalCount = document.getElementById('tourneeTotalCount');
    if (tourneeTotalCount) tourneeTotalCount.textContent = `${unvisited.length} à faire / ${targets.length} total`;

    if (targets.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl p-8 text-center flex flex-col items-center gap-3 shadow-sm border border-brand-border my-4">
          <span class="material-symbols-outlined text-[40px] text-stone-400">verified</span>
          <span class="text-base font-bold text-brand-text">Aucun restaurant dans ${this.state.selectedCommune}</span>
          <p class="text-xs text-stone-500 max-w-xs">
            Sélectionner une autre commune pour poursuivre la campagne de prospection.
          </p>
        </div>
      `;
      return;
    }

    let unvisitedIndex = 1;
    container.innerHTML = targets.map(r => {
      const isDone = r.status !== 'A_VISITER';
      const lastVis = r.last_visit;
      const indexDisplay = isDone ? '✓' : (unvisitedIndex++);

      return `
        <article class="bg-white rounded-2xl p-4 shadow-sm ${isDone ? 'border-l-4 border-emerald-500 bg-emerald-50/20' : 'border-l-4 border-brand-light'} border-y border-r border-brand-border flex items-center justify-between gap-3 hover:shadow-md transition-all">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-full ${isDone ? 'bg-emerald-600 text-white' : 'bg-brand-dark text-white'} font-bold flex items-center justify-center flex-shrink-0 text-sm shadow-sm">
              ${indexDisplay}
            </div>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-sm font-bold text-brand-text truncate">${r.name}</h4>
                ${isDone ? `
                  <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                    ✓ Visité ${lastVis?.agent ? 'par ' + lastVis.agent : ''}
                  </span>
                ` : ''}
              </div>
              <span class="text-xs text-stone-500 truncate">${r.address}</span>
              <span class="text-[11px] text-brand-light font-semibold mt-0.5">${this.calculateRealDistance(r.latitude, r.longitude)} • ${r.opening_hours || 'Horaires non renseignés'}</span>
              ${isDone && lastVis?.date ? `
                <span class="text-[10px] text-stone-400 font-medium italic mt-0.5">Dernier passage le ${lastVis.date}</span>
              ` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            ${isDone ? `
              <button class="h-9 px-3 bg-stone-100 text-brand-dark hover:bg-stone-200 text-[11px] font-bold rounded-xl flex items-center gap-1 border border-stone-200 transition-all" onclick="App.openRestaurantVisitsModal('${r.id}')" type="button" title="Voir le compte-rendu de l'équipe">
                <span class="material-symbols-outlined text-[16px] text-brand-light">history_edu</span>
                <span>Rapport</span>
              </button>
              <button class="h-9 px-2.5 bg-brand-dark/10 text-brand-dark hover:bg-brand-dark hover:text-white text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all" onclick="App.startFieldVisit('${r.id}')" type="button" title="Refaire une visite terrain">
                <span class="material-symbols-outlined text-[15px]">refresh</span>
              </button>
            ` : `
              <button class="h-10 px-4 bg-brand-dark text-white text-xs font-bold rounded-xl flex items-center gap-1 hover:bg-brand-dark/90 transition-all active:scale-95 shadow-sm" onclick="App.startFieldVisit('${r.id}')" type="button">
                <span>Go</span>
                <span class="material-symbols-outlined text-[18px] text-brand-light">play_arrow</span>
              </button>
            `}
          </div>
        </article>
      `;
    }).join('');
  },

  // Haversine distance in km (raw, for sorting)
  _haversineKm(lat, lng) {
    if (!this.state.userGpsLocation || !lat || !lng) return 99999;
    const R = 6371;
    const dLat = (lat - this.state.userGpsLocation.lat) * Math.PI / 180;
    const dLon = (lng - this.state.userGpsLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(this.state.userGpsLocation.lat*Math.PI/180) * Math.cos(lat*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  // -------------------------------------------------------------
  // VUE 5 : HISTORIQUE DES VISITES
  // -------------------------------------------------------------
  renderHistorique() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;

    const visits = this.state.visits;
    if (visits.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl p-8 text-center flex flex-col items-center gap-3 shadow-sm border border-brand-border my-4">
          <span class="material-symbols-outlined text-[40px] text-stone-400">history</span>
          <span class="text-base font-bold text-brand-text">Aucune visite enregistrée</span>
          <p class="text-xs text-stone-500 max-w-xs">
            Effectuez une première visite terrain pour alimenter l'historique de l'équipe commerciale.
          </p>
          <button class="h-10 px-5 rounded-xl bg-brand-dark text-white text-xs font-bold mt-2 hover:bg-brand-dark/90 transition-colors" onclick="App.openAuthModal('login')">
            Se connecter pour démarrer
          </button>
        </div>
      `;
      return;
    }

    const badgeStyles = {
      tres_interesse: 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold',
      interesse: 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold',
      relancer: 'bg-amber-50 text-amber-700 border border-amber-300 font-bold',
      refus: 'bg-rose-50 text-rose-700 border border-rose-300 font-bold',
      ferme: 'bg-stone-100 text-stone-600 border border-stone-200 font-bold'
    };

    container.innerHTML = visits.map(v => `
      <article class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-brand-border flex flex-col gap-3 hover:shadow-md transition-all">
        <div class="flex items-start justify-between gap-2">
          <div class="flex flex-col min-w-0">
            <span class="text-[11px] text-stone-500 font-medium">${v.date} • Agent: <strong class="text-brand-text">${v.agent}</strong></span>
            <h4 class="text-base font-bold text-brand-text truncate mt-0.5">${v.restaurant_name}</h4>
            <span class="text-xs text-stone-500">${v.commune} (${v.quartier})</span>
          </div>
          <span class="px-3 py-1 rounded-full text-[11px] font-bold flex-shrink-0 ${badgeStyles[v.result] || 'bg-stone-100 text-stone-700 border border-stone-200'}">
            ${v.result_label}
          </span>
        </div>
        ${v.contact_name ? `
          <div class="bg-stone-50 rounded-xl p-2.5 flex items-center justify-between text-brand-text text-xs border border-brand-border">
            <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-brand-light">person</span> <strong>${v.contact_name}</strong> ${v.contact_role ? `(${v.contact_role})` : ''}</span>
            ${v.contact_phone ? `<a href="tel:${v.contact_phone}" class="text-brand-dark font-bold flex items-center gap-1 hover:underline"><span class="material-symbols-outlined text-[14px] text-brand-light">call</span> ${v.contact_phone}</a>` : ''}
          </div>
        ` : ''}
        ${v.notes ? `
          <p class="text-xs text-on-surface bg-surface-container-low p-3 rounded-xl italic border border-surface-container">
            "${v.notes}"
          </p>
        ` : ''}
        ${v.next_action_label && v.next_action !== 'none' ? `
          <div class="flex items-center justify-between text-xs pt-2 border-t border-surface-container">
            <span class="flex items-center gap-1 text-secondary font-semibold">
              <span class="material-symbols-outlined text-[16px]">event_repeat</span> Prochaine action: ${v.next_action_label}
            </span>
            ${v.follow_up_date ? `<span class="text-on-surface-variant font-medium">Prévu le: ${v.follow_up_date}</span>` : ''}
          </div>
        ` : ''}

        <!-- BARRE D'ACTIONS DU RAPPORT (PDF, PARTAGER, ÉDITER, SUPPRIMER) -->
        <div class="flex items-center justify-between pt-3 border-t border-brand-border/60 text-xs mt-1">
          <div class="flex items-center gap-1.5">
            <button onclick="App.exportSingleVisitPDF('${v.id}')" type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-brand-cream hover:bg-brand-border text-brand-dark font-bold text-[11px] border border-brand-border transition-all shadow-2xs" title="Télécharger la fiche rapport au format PDF">
              <span class="material-symbols-outlined text-[15px] text-rose-700">picture_as_pdf</span>
              <span>Fiche PDF</span>
            </button>
            <button onclick="App.shareSingleVisit('${v.id}')" type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 transition-all shadow-2xs" title="Partager le compte-rendu">
              <span class="material-symbols-outlined text-[15px] text-emerald-600">share</span>
              <span>Partager</span>
            </button>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="App.openEditVisitModal('${v.id}')" type="button" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-[11px] transition-all" title="Modifier les détails de ce rapport">
              <span class="material-symbols-outlined text-[15px]">edit_note</span>
              <span>Modifier</span>
            </button>
            <button onclick="App.deleteVisit('${v.id}', event.currentTarget)" type="button" class="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-all flex items-center gap-1" title="Supprimer ce rapport">
              <span class="material-symbols-outlined text-[17px] pointer-events-none">delete</span>
            </button>
          </div>
        </div>
      </article>
    `).join('');
  },

  // -------------------------------------------------------------
  // EXPORT CSV
  // -------------------------------------------------------------
  exportVisitsCSV() {
    const visits = this.state.visits;
    if (!visits.length) { this.showToast('Aucune visite à exporter', 'info'); return; }
    const headers = ['ID','Date','Agent','Restaurant','Commune','Quartier','Résultat','Contact','Téléphone','Notes','Prochaine action','Date relance'];
    const rows = visits.map(v => [
      v.id, v.date, v.agent, v.restaurant_name, v.commune, (v.quartier||'').trim(),
      v.result_label, v.contact_name, v.contact_phone, (v.notes||'').replace(/,/g,''), v.next_action_label, v.follow_up_date||''
    ].map(c => `"${(c||'').toString().replace(/"/g,'""')}"`));
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visites_menuscan_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast(`${visits.length} visites exportées en CSV`, 'success');
  },

  exportRestaurantsCSV() {
    const restaurants = this.state.restaurants;
    if (!restaurants.length) { this.showToast('Aucun restaurant à exporter', 'info'); return; }
    const headers = ['ID','Nom','Commune','Quartier','Adresse','Téléphone','Cuisine','Statut','Latitude','Longitude','Géocodage','Source','Décisionnaire','Tél. décisionnaire','Dernière visite'];
    const rows = restaurants.map(r => [
      r.id, r.name, r.commune, r.zone||r.quartier, r.address, r.phone||'',
      r.cuisine||'', r.status, r.latitude||'', r.longitude||'', r.geocode_status||'',
      r.source||'', (r.decision_maker?.name||''), (r.decision_maker?.phone||''),
      (r.last_visit?.date||'')
    ].map(c => `"${(c||'').toString().replace(/"/g,'""')}"`));
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restaurants_menuscan_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast(`${restaurants.length} restaurants exportés en CSV`, 'success');
  },

  // Internal blob URL for the currently open PDF
  _currentPdfBlobUrl: null,

  openPdfViewer(blobUrl, filename, title) {
    // Revoke any previous blob URL
    if (this._currentPdfBlobUrl) {
      URL.revokeObjectURL(this._currentPdfBlobUrl);
    }
    this._currentPdfBlobUrl = blobUrl;

    const modal = document.getElementById('pdfViewerModal');
    const frame = document.getElementById('pdfViewerFrame');
    const titleEl = document.getElementById('pdfViewerTitle');
    const downloadBtn = document.getElementById('pdfDownloadBtn');

    if (!modal || !frame) {
      // Fallback: direct download if no modal
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (titleEl) titleEl.textContent = title || filename || 'Rapport PDF';
    if (downloadBtn) {
      downloadBtn.href = blobUrl;
      downloadBtn.download = filename;
    }
    frame.src = blobUrl;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  closePdfViewer() {
    const modal = document.getElementById('pdfViewerModal');
    const frame = document.getElementById('pdfViewerFrame');
    if (modal) modal.classList.add('hidden');
    if (frame) frame.src = '';
    document.body.style.overflow = '';
    if (this._currentPdfBlobUrl) {
      setTimeout(() => URL.revokeObjectURL(this._currentPdfBlobUrl), 1000);
      this._currentPdfBlobUrl = null;
    }
  },

  saveAndPreviewPDF(doc, filename, toastMsg) {
    try {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const safeFilename = filename.endsWith('.pdf') ? filename : filename + '.pdf';

      // Open in inline PDF viewer modal (no popup blocker issues)
      this.openPdfViewer(blobUrl, safeFilename, safeFilename.replace(/_/g, ' ').replace('.pdf', ''));

      if (toastMsg) this.showToast(toastMsg, 'success');
    } catch (e) {
      console.error('Erreur export PDF:', e);
      doc.save(filename);
    }
  },

  // -------------------------------------------------------------
  // EXPORT PDF
  // -------------------------------------------------------------
  exportVisitsPDF() {
    const visits = this.state.visits;
    if (!visits || !visits.length) { this.showToast('Aucune visite à exporter', 'info'); return; }

    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDF) {
      alert('Module de génération PDF non disponible.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.setTextColor(43, 29, 23);
    doc.text('Menu Scan — Rapport d\'Historique des Visites', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(120, 100, 90);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} — Total : ${visits.length} visites`, 14, 22);

    const headers = [['Date', 'Agent', 'Restaurant', 'Commune', 'Quartier', 'Résultat', 'Contact', 'Téléphone', 'Prochaine Action']];
    const data = visits.map(v => [
      v.date || '',
      v.agent || '',
      v.restaurant_name || '',
      v.commune || '',
      v.quartier || '',
      v.result_label || '',
      v.contact_name || '',
      v.contact_phone || '',
      v.next_action_label || ''
    ]);

    doc.autoTable({
      head: headers,
      body: data,
      startY: 27,
      theme: 'grid',
      headStyles: { fillColor: [43, 29, 23], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [248, 245, 240] },
      styles: { fontSize: 8, cellPadding: 2.5 }
    });

    this.saveAndPreviewPDF(doc, `visites_menuscan_${new Date().toISOString().slice(0, 10)}.pdf`, `${visits.length} visites exportées et affichées en PDF ✓`);
  },

  exportRestaurantsPDF() {
    const restaurants = this.state.restaurants;
    if (!restaurants || !restaurants.length) { this.showToast('Aucun restaurant à exporter', 'info'); return; }

    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDF) {
      alert('Module de génération PDF non disponible.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.setTextColor(43, 29, 23);
    doc.text('Menu Scan — Liste des Établissements Prospectés', 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(120, 100, 90);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} — Total : ${restaurants.length} établissements`, 14, 22);

    const headers = [['ID', 'Nom', 'Commune', 'Quartier', 'Adresse', 'Téléphone', 'Cuisine', 'Statut', 'Décisionnaire']];
    const data = restaurants.map(r => [
      r.id || '',
      r.name || '',
      r.commune || '',
      r.zone || r.quartier || '',
      r.address || '',
      r.phone || '',
      r.cuisine || '',
      r.status || '',
      r.decision_maker?.name ? `${r.decision_maker.name} (${r.decision_maker.phone || ''})` : ''
    ]);

    doc.autoTable({
      head: headers,
      body: data,
      startY: 27,
      theme: 'grid',
      headStyles: { fillColor: [78, 52, 46], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [248, 245, 240] },
      styles: { fontSize: 8, cellPadding: 2.5 }
    });

    this.saveAndPreviewPDF(doc, `restaurants_menuscan_${new Date().toISOString().slice(0, 10)}.pdf`, `${restaurants.length} restaurants exportés et affichés en PDF ✓`);
  },

  // -------------------------------------------------------------
  // EXPORT & ÉDITION D'UN RAPPORT DE VISITE INDIVIDUEL
  // -------------------------------------------------------------
  exportSingleVisitPDF(visitId) {
    const visit = this.state.visits.find(v => v.id === visitId);
    if (!visit) { this.showToast('Visite introuvable', 'error'); return; }

    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDF) {
      alert('Module de génération PDF non disponible.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // En-tête / Header banner
    doc.setFillColor(43, 29, 23); // brand-dark
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MENU SCAN — RAPPORT DE VISITE TERRAIN', 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(215, 204, 200);
    doc.text(`Fiche individuelle de prospection — Réf: ${visit.id}`, 14, 25);

    // Section Établissement
    doc.setFillColor(252, 250, 246);
    doc.roundedRect(14, 38, 182, 32, 3, 3, 'F');
    doc.setDrawColor(230, 220, 210);
    doc.roundedRect(14, 38, 182, 32, 3, 3, 'D');

    doc.setTextColor(43, 29, 23);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(visit.restaurant_name || 'Établissement', 18, 47);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 90, 85);
    doc.text(`Commune: ${visit.commune || ''} | Quartier: ${visit.quartier || 'Non précisé'}`, 18, 54);
    doc.text(`Agent commercial: ${visit.agent || 'N/C'} | Horodatage: ${visit.date || ''}`, 18, 61);

    // Résultat Badge Block
    doc.setFillColor(240, 249, 244);
    doc.roundedRect(14, 75, 182, 18, 3, 3, 'F');
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(14, 75, 182, 18, 3, 3, 'D');

    doc.setTextColor(6, 95, 70);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Statut & Résultat: ${visit.result_label || visit.result}`, 18, 86);

    // Interlocuteur / Décisionnaire
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 210, 200);
    doc.roundedRect(14, 98, 182, 28, 3, 3, 'D');

    doc.setTextColor(43, 29, 23);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Décisionnaire / Interlocuteur rencontré', 18, 106);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const contactInfo = `Nom: ${visit.contact_name || 'Non renseigné'} ${visit.contact_role ? '(' + visit.contact_role + ')' : ''}`;
    const phoneInfo = `Téléphone: ${visit.contact_phone || 'Non renseigné'}`;
    doc.text(contactInfo, 18, 115);
    doc.text(phoneInfo, 120, 115);

    // Compte-rendu & Notes de terrain
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(43, 29, 23);
    doc.text('Compte-rendu & Observations de terrain', 14, 134);

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(230, 230, 230);
    doc.roundedRect(14, 138, 182, 50, 3, 3, 'FD');

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'oblique');
    doc.setTextColor(50, 50, 50);
    const splitNotes = doc.splitTextToSize(visit.notes || 'Aucune observation saisie.', 174);
    doc.text(splitNotes, 18, 147);

    // Prochaine Action / Relance
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(14, 194, 182, 20, 3, 3, 'F');
    doc.setDrawColor(252, 211, 77);
    doc.roundedRect(14, 194, 182, 20, 3, 3, 'D');

    doc.setTextColor(146, 64, 14);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Prochaine action prévue: ${visit.next_action_label || 'Aucune relance'}`, 18, 206);
    if (visit.follow_up_date) {
      doc.text(`Date de relance: ${visit.follow_up_date}`, 130, 206);
    }

    // Pied de page / Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`Document généré par l'application Menu Scan — Prospection Commerciale Abidjan (${new Date().toLocaleDateString('fr-FR')})`, 14, 280);

    const safeRestName = (visit.restaurant_name || 'Restaurant').replace(/[^a-zA-Z0-9]/g, '_');
    const safeDate = (visit.date || '').slice(0, 10).replace(/[^0-9]/g, '-');
    this.saveAndPreviewPDF(doc, `Rapport_Visite_${safeRestName}_${safeDate}.pdf`, 'Rapport PDF affiché et téléchargé ✓');
  },

  async shareSingleVisit(visitId) {
    const visit = this.state.visits.find(v => v.id === visitId);
    if (!visit) return;

    const text = `📋 *RAPPORT DE VISITE - MENU SCAN*\n` +
      `🏢 *Établissement:* ${visit.restaurant_name} (${visit.commune})\n` +
      `👤 *Agent:* ${visit.agent}\n` +
      `📅 *Date:* ${visit.date}\n` +
      `📌 *Résultat:* ${visit.result_label}\n` +
      `👤 *Contact:* ${visit.contact_name || 'N/C'} ${visit.contact_role ? '(' + visit.contact_role + ')' : ''} ${visit.contact_phone ? '📞 ' + visit.contact_phone : ''}\n` +
      `💬 *Compte-rendu:* "${visit.notes || ''}"\n` +
      `🗓️ *Prochaine action:* ${visit.next_action_label || 'Néant'}${visit.follow_up_date ? ' (Prévu le ' + visit.follow_up_date + ')' : ''}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rapport Visite ${visit.restaurant_name}`,
          text: text
        });
        this.showToast('Rapport partagé avec succès !', 'success');
        return;
      } catch (err) {
        // Annulation ou partage non pris en charge
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Rapport copié dans le presse-papier !', 'success');
    } catch (e) {
      alert(text);
    }
  },

  openEditVisitModal(visitId) {
    const visit = this.state.visits.find(v => v.id === visitId);
    if (!visit) { this.showToast('Visite introuvable', 'error'); return; }

    document.getElementById('editVisitId').value = visit.id;
    document.getElementById('editVisitModalSubtitle').textContent = `${visit.restaurant_name} — ${visit.date}`;
    document.getElementById('editVisitResult').value = visit.result || 'tres_interesse';
    document.getElementById('editVisitContactName').value = visit.contact_name || '';
    document.getElementById('editVisitContactRole').value = visit.contact_role || '';
    document.getElementById('editVisitContactPhone').value = visit.contact_phone || '';
    document.getElementById('editVisitNotes').value = visit.notes || '';
    document.getElementById('editVisitNextAction').value = visit.next_action || 'none';
    document.getElementById('editVisitFollowUpDate').value = visit.follow_up_date || '';

    const modal = document.getElementById('editVisitModal');
    if (modal) modal.classList.remove('hidden');
  },

  closeEditVisitModal() {
    const modal = document.getElementById('editVisitModal');
    if (modal) modal.classList.add('hidden');
  },

  openRestaurantVisitsModal(restaurantId) {
    const restaurant = this.state.restaurants.find(r => r.id === restaurantId || r.google_place_id === restaurantId);
    if (!restaurant) { this.showToast('Établissement introuvable', 'error'); return; }

    const visits = this.state.visits.filter(v => v.restaurant_id === restaurant.id || v.google_place_id === restaurant.google_place_id);

    const titleEl = document.getElementById('restaurantVisitsModalTitle');
    const subTitleEl = document.getElementById('restaurantVisitsModalSubtitle');
    if (titleEl) titleEl.textContent = `Rapports : ${restaurant.name}`;
    if (subTitleEl) subTitleEl.textContent = `${restaurant.commune} (${restaurant.zone || restaurant.quartier || ''}) — ${visits.length} passage(s) enregistré(s)`;

    const container = document.getElementById('restaurantVisitsModalList');
    if (!container) return;

    if (visits.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center bg-stone-50 rounded-2xl border border-brand-border flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-[36px] text-stone-400">hourglass_empty</span>
          <span class="text-sm font-bold text-brand-text">Aucun rapport enregistré pour le moment</span>
          <p class="text-xs text-stone-500 max-w-xs">Aucun agent commercial n'a encore saisi de visite terrain pour cet établissement.</p>
          <button class="h-9 px-4 rounded-xl bg-brand-dark text-white text-xs font-bold mt-2 hover:bg-brand-dark-hover transition-colors" onclick="App.closeRestaurantVisitsModal(); App.startFieldVisit('${restaurant.id}')">
            Démarrer une première visite
          </button>
        </div>
      `;
    } else {
      const badgeStyles = {
        tres_interesse: 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold',
        interesse: 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold',
        relancer: 'bg-amber-50 text-amber-700 border border-amber-300 font-bold',
        refus: 'bg-rose-50 text-rose-700 border border-rose-300 font-bold',
        ferme: 'bg-stone-100 text-stone-600 border border-stone-200 font-bold'
      };

      container.innerHTML = visits.map(v => `
        <article class="bg-brand-cream/40 rounded-2xl p-4 border border-brand-border flex flex-col gap-2.5">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[11px] text-stone-500 font-semibold">${v.date} • Agent: <strong class="text-brand-text">${v.agent}</strong></span>
              <h4 class="text-xs font-bold text-brand-text mt-0.5">${v.result_label}</h4>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${badgeStyles[v.result] || 'bg-stone-100 text-stone-700 border border-stone-200'} flex-shrink-0">
              ${v.result_label}
            </span>
          </div>

          ${v.contact_name ? `
            <div class="bg-white rounded-xl p-2.5 text-xs text-brand-text border border-brand-border flex items-center justify-between">
              <span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-brand-light">person</span> <strong>${v.contact_name}</strong> ${v.contact_role ? `(${v.contact_role})` : ''}</span>
              ${v.contact_phone ? `<a href="tel:${v.contact_phone}" class="text-brand-dark font-bold hover:underline flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-brand-light">call</span> ${v.contact_phone}</a>` : ''}
            </div>
          ` : ''}

          ${v.notes ? `
            <p class="text-xs text-stone-700 bg-white p-3 rounded-xl italic border border-brand-border/60">
              "${v.notes}"
            </p>
          ` : ''}

          ${v.next_action_label && v.next_action !== 'none' ? `
            <div class="text-xs text-amber-900 font-semibold bg-amber-50 p-2 rounded-xl border border-amber-200 flex items-center justify-between">
              <span>📌 Prochaine action: ${v.next_action_label}</span>
              ${v.follow_up_date ? `<span>Prévu le: ${v.follow_up_date}</span>` : ''}
            </div>
          ` : ''}

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-brand-border/40">
            <button onclick="App.exportSingleVisitPDF('${v.id}')" type="button" class="px-2.5 py-1 rounded-lg bg-white border border-brand-border text-brand-dark font-bold text-[11px] flex items-center gap-1 hover:bg-brand-cream">
              <span class="material-symbols-outlined text-[14px] text-rose-700">picture_as_pdf</span>
              <span>Fiche PDF</span>
            </button>
            <button onclick="App.shareSingleVisit('${v.id}')" type="button" class="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px] flex items-center gap-1 hover:bg-emerald-100">
              <span class="material-symbols-outlined text-[14px] text-emerald-600">share</span>
              <span>Partager</span>
            </button>
          </div>
        </article>
      `).join('');
    }

    const modal = document.getElementById('restaurantVisitsModal');
    if (modal) modal.classList.remove('hidden');
  },

  closeRestaurantVisitsModal() {
    const modal = document.getElementById('restaurantVisitsModal');
    if (modal) modal.classList.add('hidden');
  },

  async handleUpdateVisitSubmit(e) {
    e.preventDefault();
    const visit_id = document.getElementById('editVisitId').value;
    const result = document.getElementById('editVisitResult').value;
    const contact_name = document.getElementById('editVisitContactName').value.trim();
    const contact_role = document.getElementById('editVisitContactRole').value.trim();
    const contact_phone = document.getElementById('editVisitContactPhone').value.trim();
    const notes = document.getElementById('editVisitNotes').value.trim();
    const next_action = document.getElementById('editVisitNextAction').value;
    const follow_up_date = document.getElementById('editVisitFollowUpDate').value;

    try {
      const res = await fetch('api.php?action=update_visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visit_id, result, contact_name, contact_role, contact_phone, notes, next_action, follow_up_date })
      }).then(r => r.json());

      if (res.success) {
        this.closeEditVisitModal();
        this.showToast('Rapport de visite modifié avec succès !', 'success');
        await this.loadData(true);
        this.renderHistorique();
      } else {
        alert(res.error || 'Erreur lors de la mise à jour du rapport');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau lors de la mise à jour.');
    }
  },

  async deleteVisit(visitId, btnElement) {
    if (!btnElement) return;

    // Confirmation simple avant suppression
    if (!confirm('Supprimer ce rapport de visite ? Cette action est irréversible.')) return;

    btnElement.disabled = true;
    btnElement.style.opacity = '0.5';

    try {
      const res = await fetch('api.php?action=delete_visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visit_id: visitId })
      }).then(r => r.json());

      if (res.success) {
        this.showToast('Rapport de visite supprimé ✓', 'info');
        await this.loadData(true);
        this.renderHistorique();
      } else {
        btnElement.disabled = false;
        btnElement.style.opacity = '1';
        this.showToast(res.error || 'Erreur lors de la suppression', 'error');
      }
    } catch (err) {
      btnElement.disabled = false;
      btnElement.style.opacity = '1';
      console.error(err);
      this.showToast('Erreur réseau lors de la suppression.', 'error');
    }
  },

  // -------------------------------------------------------------
  // MODAL AJOUT RESTAURANT
  // -------------------------------------------------------------
  openAddRestaurantModal() {
    const modal = document.getElementById('addRestaurantModal');
    if (!modal) return;
    // Reset form
    const form = document.getElementById('formAddRestaurant');
    if (form) form.reset();
    // Pre-select current commune
    const communeSelect = document.getElementById('addRestCommune');
    if (communeSelect) communeSelect.value = this.state.selectedCommune;
    modal.classList.remove('hidden');
  },

  closeAddRestaurantModal() {
    const modal = document.getElementById('addRestaurantModal');
    if (modal) modal.classList.add('hidden');
  },

  async handleAddRestaurantSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('addRestSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }

    const payload = {
      name: document.getElementById('addRestName')?.value.trim() || '',
      commune: document.getElementById('addRestCommune')?.value || this.state.selectedCommune,
      quartier: document.getElementById('addRestQuartier')?.value.trim() || '',
      address: document.getElementById('addRestAddress')?.value.trim() || '',
      phone: document.getElementById('addRestPhone')?.value.trim() || '',
      cuisine: document.getElementById('addRestCuisine')?.value.trim() || 'Restaurant / Maquis',
      latitude: document.getElementById('addRestLat')?.value.trim() || null,
      longitude: document.getElementById('addRestLng')?.value.trim() || null
    };

    if (!payload.name) {
      this.showToast('Le nom du restaurant est requis', 'info');
      if (btn) { btn.disabled = false; btn.textContent = 'Créer le restaurant'; }
      return;
    }

    try {
      const res = await fetch('api.php?action=add_restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res.success) {
        this.closeAddRestaurantModal();
        await this.loadData();
        this.showToast(`Restaurant "${payload.name}" créé avec succès !`, 'success');
        // Navigate to restaurants view
        this.selectCommune(payload.commune);
      } else {
        this.showToast(res.error || 'Erreur lors de la création', 'info');
      }
    } catch (err) {
      console.error(err);
      this.showToast('Erreur réseau', 'info');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Créer le restaurant'; }
    }
  },

  // -------------------------------------------------------------
  // ADMIN PANEL
  // -------------------------------------------------------------
  openAdminPanel() {
    if (!this.state.currentUser || this.state.currentUser.role !== 'ADMIN') {
      this.showToast('Accès réservé aux administrateurs', 'info');
      return;
    }
    const modal = document.getElementById('adminPanelModal');
    if (!modal) return;
    this.loadAdminData();
    modal.classList.remove('hidden');
  },

  closeAdminPanel() {
    const modal = document.getElementById('adminPanelModal');
    if (modal) modal.classList.add('hidden');
  },

  async loadAdminData() {
    try {
      const res = await fetch('api.php?action=users').then(r => r.json());
      if (res.success) {
        this.renderAdminUsers(res.users);
      }
    } catch (e) {
      console.warn('Erreur chargement admin:', e);
    }
  },

  renderAdminUsers(users) {
    const container = document.getElementById('adminUsersGrid');
    if (!container) return;

    const communes = ['Cocody','Marcory','Plateau','Yopougon','Treichville','Koumassi','Port-Bouët'];

    if (!users.length) {
      container.innerHTML = `<div class="col-span-full text-center text-xs text-brand-muted p-6">Aucun utilisateur enregistré.</div>`;
      return;
    }

    container.innerHTML = users.map(u => {
      const initial = (u.name||'U').charAt(0).toUpperCase();
      const roleLabel = u.role === 'ADMIN' ? 'Boss / Admin' : 'Agent Terrain';
      const roleBg = u.role === 'ADMIN' ? 'bg-brand-dark text-white' : 'bg-brand-cream text-brand-text border border-brand-border';
      const assignedCommunes = u.assigned_communes || [];

      return `
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-brand-border flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-full bg-brand-light text-white font-bold flex items-center justify-center text-base shadow-sm flex-shrink-0">${initial}</div>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-sm font-bold text-brand-text truncate">${u.name}</span>
              <span class="text-xs text-brand-muted truncate">${u.email}</span>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${roleBg}">${roleLabel}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[11px] font-bold text-brand-muted">Communes assignées :</span>
            <div class="flex flex-wrap gap-1">
              ${communes.map(c => {
                const isAssigned = assignedCommunes.includes(c);
                return `<button onclick="App.toggleUserCommune('${u.id}', '${c}', this)" class="px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${
                  isAssigned ? 'bg-brand-dark text-white' : 'bg-brand-cream text-brand-muted border border-brand-border hover:bg-brand-border'
                }">${c}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="flex gap-2 pt-1 border-t border-brand-border">
            <button onclick="App.changeUserRole('${u.id}', '${u.role === 'ADMIN' ? 'AGENT' : 'ADMIN'}')" class="flex-1 h-9 text-[11px] font-bold rounded-xl bg-brand-cream text-brand-dark hover:bg-brand-border border border-brand-border transition-colors">
              ${u.role === 'ADMIN' ? '→ Rétrograder Agent' : '→ Promouvoir Admin'}
            </button>
            <button onclick="App.deleteUser('${u.id}', '${u.name.replace(/'/g, '\\&apos;')}', this)" class="h-9 px-3 text-[11px] font-bold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px] pointer-events-none">delete</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Update user count
    const countBadge = document.getElementById('adminUserCountBadge');
    if (countBadge) countBadge.textContent = `${users.length} Membres`;
  },

  async toggleUserCommune(userId, commune, btn) {
    try {
      const res = await fetch('api.php?action=toggle_user_commune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, commune })
      }).then(r => r.json());

      if (res.success) {
        const isAssigned = res.assigned;
        btn.className = `px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${
          isAssigned ? 'bg-brand-dark text-white' : 'bg-brand-cream text-brand-muted border border-brand-border hover:bg-brand-border'
        }`;
        this.showToast(isAssigned ? `${commune} assignée` : `${commune} retirée`, 'success');
      } else {
        this.showToast(res.error || 'Erreur', 'info');
      }
    } catch (e) { console.error(e); }
  },

  async changeUserRole(userId, newRole) {
    try {
      const res = await fetch('api.php?action=update_user_role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: newRole })
      }).then(r => r.json());

      if (res.success) {
        this.showToast(`Rôle mis à jour : ${newRole}`, 'success');
        this.loadAdminData();
      } else {
        this.showToast(res.error || 'Erreur', 'info');
      }
    } catch (e) { console.error(e); }
  },

  pendingDeleteDrawerId: null,

  async deleteUser(userId, userName, btnElement) {
    if (this.pendingDeleteDrawerId !== userId) {
      this.pendingDeleteDrawerId = userId;
      if (btnElement) {
        btnElement.className = "h-9 px-3 text-[11px] font-bold rounded-xl bg-rose-600 text-white shadow-md transition-all flex items-center gap-1 animate-pulse";
        btnElement.innerHTML = `<span class="material-symbols-outlined text-[14px] pointer-events-none">warning</span><span>Confirmer ?</span>`;
      }
      setTimeout(() => {
        if (this.pendingDeleteDrawerId === userId) {
          this.pendingDeleteDrawerId = null;
          if (btnElement) {
            btnElement.className = "h-9 px-3 text-[11px] font-bold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1";
            btnElement.innerHTML = `<span class="material-symbols-outlined text-[16px] pointer-events-none">delete</span>`;
          }
        }
      }, 4000);
      return;
    }

    this.pendingDeleteDrawerId = null;
    try {
      const res = await fetch('api.php?action=delete_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      }).then(r => r.json());

      if (res.success) {
        this.showToast('Utilisateur supprimé avec succès', 'success');
        this.loadAdminData();
        await this.loadData();
      } else {
        this.showToast(res.error || 'Erreur lors de la suppression', 'info');
      }
    } catch (e) { console.error(e); }
  },

  pendingResetVisitsDrawer: false,

  async resetAllVisits(btnElement) {
    if (!this.pendingResetVisitsDrawer) {
      this.pendingResetVisitsDrawer = true;
      if (btnElement) {
        btnElement.className = "h-10 px-4 bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 animate-pulse";
        btnElement.innerHTML = `<span class="material-symbols-outlined text-[16px]">warning</span><span>Confirmer la réinitialisation ?</span>`;
      }
      setTimeout(() => {
        this.pendingResetVisitsDrawer = false;
        if (btnElement) {
          btnElement.className = "h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5";
          btnElement.innerHTML = `<span class="material-symbols-outlined text-[16px]">delete_sweep</span><span>Réinitialiser toutes les visites</span>`;
        }
      }, 4000);
      return;
    }

    this.pendingResetVisitsDrawer = false;
    try {
      const res = await fetch('api.php?action=reset_system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }).then(r => r.json());
      if (res.success) {
        this.showToast('Base de données réinitialisée !', 'success');
        await this.loadData();
        this.closeAdminPanel();
      } else {
        this.showToast(res.error || 'Erreur', 'info');
      }
    } catch (e) { console.error(e); }
  },

  // -------------------------------------------------------------
  // GOOGLE MAPS CONFIG MODAL LOGIC
  // -------------------------------------------------------------
  openConfigModal() {
    const modal = document.getElementById('configModal');
    if (!modal) return;
    modal.classList.remove('hidden');
  },

  closeConfigModal() {
    const modal = document.getElementById('configModal');
    if (modal) modal.classList.add('hidden');
  },

  async handleSaveConfigSubmit(e) {
    e.preventDefault();
    const apiKey = document.getElementById('cfgApiKey').value;

    try {
      const res = await fetch('api.php?action=save_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_maps_api_key: apiKey })
      }).then(r => r.json());

      if (res.success) {
        this.closeConfigModal();
        this.showToast('Clé API Google Maps enregistrée !', 'success');
        await this.loadConfig();
      } else {
        alert(res.error || 'Erreur lors de l\'enregistrement de la clé');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau.');
    }
  },

  // -------------------------------------------------------------
  // AUTHENTICATION MODAL LOGIC
  // -------------------------------------------------------------
  toggleAuthOrProfile() {
    if (this.state.currentUser) {
      // User is logged in — clicking the profile card opens auth modal to show profile info
      // The logout button is separate (sidebarLogoutBtn)
      this.openAuthModal();
    } else {
      this.openAuthModal('login');
    }
  },

  openAuthModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    const closeBtn = document.getElementById('authModalCloseBtn');
    if (closeBtn) closeBtn.classList.remove('hidden');
    modal.classList.remove('hidden');
  },

  closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('hidden');
  },

  togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = btnEl.querySelector('.material-symbols-outlined');
    if (icon) {
      icon.textContent = isPassword ? 'visibility_off' : 'visibility';
    }
    if (isPassword) {
      btnEl.classList.add('text-brand-dark');
      btnEl.classList.remove('text-brand-muted');
    } else {
      btnEl.classList.remove('text-brand-dark');
      btnEl.classList.add('text-brand-muted');
    }
  },

  async handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
      const res = await fetch('api.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }).then(r => r.json());

      if (res.success) {
        this.state.currentUser = res.user;
        this.updateUserUI();
        this.closeAuthModal();
        this.showToast(`Bienvenue ${res.user.name} ! Session active.`, 'success');
        await this.loadData();
        this.renderCurrentTab();
      } else {
        alert(res.error || 'Erreur lors de la connexion');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau lors de la connexion.');
    }
  },

  async handleRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;
    const roleEl = document.querySelector('input[name="regRole"]:checked');
    const role = roleEl ? roleEl.value : 'AGENT';

    try {
      const res = await fetch('api.php?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, role })
      }).then(r => r.json());

      if (res.success) {
        this.state.currentUser = res.user;
        this.updateUserUI();
        this.closeAuthModal();
        this.showToast(`Compte créé avec succès ! Bienvenue ${res.user.name}`, 'success');
        await this.loadData();
      } else {
        alert(res.error || 'Erreur lors de la création du compte');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau lors de la création du compte.');
    }
  },

  async logout() {
    try {
      const res = await fetch('api.php?action=logout').then(r => r.json());
      this.state.currentUser = null;
      this.updateUserUI();
      this.navigateTo('accueil');
      this.showToast('Déconnexion effectuée avec succès.', 'info');
    } catch (e) {
      console.error(e);
      this.showToast('Erreur lors de la déconnexion', 'error');
    }
  },

  // -------------------------------------------------------------
  // MODALE : DÉTAIL RESTAURANT & VISITE EN COURS
  // -------------------------------------------------------------
  openRestaurantDetail(restaurantId) {
    const restaurant = this.state.restaurants.find(r => r.id === restaurantId || r.google_place_id === restaurantId);
    if (!restaurant) return;
    this.state.activeRestaurant = restaurant;

    const modal = document.getElementById('visitDetailModal');
    if (!modal) return;

    const photoSrc = restaurant.photo || 'assets/restaurant_placeholder.svg';
    document.getElementById('modalVenuePhoto').src = photoSrc;
    document.getElementById('modalVenueName').textContent = restaurant.name;
    document.getElementById('modalVenueCuisine').textContent = restaurant.cuisine || 'Restaurant / Maquis';
    document.getElementById('modalVenueAddress').innerHTML = `${restaurant.commune} ${restaurant.zone || ''}<br>${restaurant.address}`;
    document.getElementById('modalVenueHours').textContent = restaurant.opening_hours || 'Non renseigné';
    document.getElementById('modalVenueDistance').textContent = this.calculateRealDistance(restaurant.latitude, restaurant.longitude);
    document.getElementById('modalVenuePhone').textContent = restaurant.phone || 'Non renseigné';
    
    const sourceBadge = document.getElementById('modalSourceBadge');
    if (sourceBadge) {
      const geocodeLabel = { localise: 'OSM/Nominatim', corrige_manuellement: 'Corrigé manuellement', non_localise: 'Non localisé' };
      sourceBadge.textContent = geocodeLabel[restaurant.geocode_status] || restaurant.source || 'Source réelle';
    }

    const statusBadge = document.getElementById('modalStatusBadge');
    if (statusBadge) {
      if (restaurant.status === 'VISITE') {
        statusBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold shadow-sm';
        statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-600"></span> VISITÉ';
      } else if (restaurant.status === 'A_RELANCER') {
        statusBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-300 text-xs font-bold shadow-sm';
        statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-600"></span> À RAPPELER';
      } else if (restaurant.status === 'REFUS') {
        statusBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-300 text-xs font-bold shadow-sm';
        statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-600"></span> REFUS';
      } else {
        statusBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-300 text-xs font-bold shadow-sm';
        statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-stone-500"></span> À VISITER';
      }
    }

    const callLink = document.getElementById('modalCallLink');
    if (restaurant.phone) {
      callLink.href = `tel:${restaurant.phone}`;
      callLink.classList.remove('pointer-events-none', 'opacity-40');
    } else {
      callLink.removeAttribute('href');
      callLink.classList.add('pointer-events-none', 'opacity-40');
    }

    const routeBtn = document.getElementById('modalRouteBtn');
    if (restaurant.latitude && restaurant.longitude) {
      routeBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}`;
      routeBtn.classList.remove('pointer-events-none', 'opacity-40');
    } else {
      routeBtn.href = '#';
      routeBtn.classList.add('pointer-events-none', 'opacity-40');
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Initialize mini-map after modal is visible
    setTimeout(() => this.initModalMiniMap(restaurant), 200);
  },

  initModalMiniMap(restaurant) {
    const mapEl = document.getElementById('modalMiniMap');
    if (!mapEl) return;

    const hasCoords = restaurant.latitude && restaurant.longitude
      && restaurant.geocode_status !== 'non_localise';

    const noCoordsOverlay = document.getElementById('modalNoCoordsOverlay');

    // Destroy previous instance
    if (this.state.modalMiniMap) {
      this.state.modalMiniMap.remove();
      this.state.modalMiniMap = null;
      this.state.modalMiniMapMarker = null;
    }

    if (!hasCoords) {
      if (noCoordsOverlay) noCoordsOverlay.classList.remove('hidden');
      mapEl.style.filter = 'blur(2px)';
      return;
    }

    if (noCoordsOverlay) noCoordsOverlay.classList.add('hidden');
    mapEl.style.filter = '';

    const lat = parseFloat(restaurant.latitude);
    const lng = parseFloat(restaurant.longitude);
    const canEdit = this.state.currentUser && (this.state.currentUser.role === 'ADMIN' || this.state.currentUser.role === 'AGENT');

    try {
      const miniMap = L.map('modalMiniMap', {
        zoomControl: true,
        attributionControl: false,
        dragging: true
      }).setView([lat, lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(miniMap);

      const cfg = this.getStatusConfig(restaurant.status);
      const markerIcon = L.divIcon({
        className: '',
        html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:32px;height:32px;border-radius:50%;background:${cfg.color};color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.3);border:2.5px solid #fff">
            <span class="material-symbols-outlined" style="font-size:16px">${cfg.icon}</span>
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${cfg.color};margin-top:-1px"></div>
        </div>`,
        iconSize: [32, 39],
        iconAnchor: [16, 39]
      });

      const marker = L.marker([lat, lng], {
        icon: markerIcon,
        draggable: canEdit
      }).addTo(miniMap);

      if (canEdit) {
        marker.on('dragend', async (e) => {
          const pos = e.target.getLatLng();
          const coordsEl = document.getElementById('modalMiniMapCoords');
          if (coordsEl) coordsEl.textContent = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;

          try {
            const res = await fetch('api.php?action=update_coordinates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              // Fix: API expects 'id', not 'restaurant_id'
              body: JSON.stringify({
                id: restaurant.id,
                latitude: pos.lat,
                longitude: pos.lng
              })
            }).then(r => r.json());

            if (res.success) {
              this.showToast('Position mise à jour manuellement ✓', 'success');
              await this.loadData(true);
              const updated = this.state.restaurants.find(r2 => r2.id === restaurant.id);
              if (updated) this.state.activeRestaurant = updated;
            } else {
              this.showToast('Erreur mise à jour position', 'info');
            }
          } catch (err) {
            console.error(err);
          }
        });

        marker.bindTooltip('Glisser pour corriger la position', { permanent: false });
      }

      const coordsEl = document.getElementById('modalMiniMapCoords');
      if (coordsEl) coordsEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      this.state.modalMiniMap = miniMap;
      this.state.modalMiniMapMarker = marker;
      setTimeout(() => miniMap.invalidateSize(), 100);
    } catch (e) {
      console.warn('Mini-map error:', e);
    }
  },

  startFieldVisit(restaurantId) {
    if (!this.state.currentUser) {
      this.openAuthModal('login');
      this.showToast('Veuillez vous connecter pour démarrer une visite terrain.', 'info');
      return;
    }

    this.openRestaurantDetail(restaurantId);

    this.state.timerSeconds = 0;
    clearInterval(this.state.timerInterval);

    const now = new Date();
    const startStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const startTimeEl = document.getElementById('visitStartTime');
    if (startTimeEl) startTimeEl.textContent = `Début: ${startStr}`;

    const timerEl = document.getElementById('visitTimer');
    this.state.timerInterval = setInterval(() => {
      this.state.timerSeconds++;
      const min = Math.floor(this.state.timerSeconds / 60);
      const sec = this.state.timerSeconds % 60;
      if (timerEl) {
        timerEl.innerHTML = `<span>${String(min).padStart(2, '0')}</span><span class="text-brand-light">:</span><span>${String(sec).padStart(2, '0')}</span>`;
      }
    }, 1000);

    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    this.showToast(`Session démarrée par ${this.state.currentUser.name}`, 'info');
  },

  finishVisitAndOpenReport() {
    clearInterval(this.state.timerInterval);
    const durationMin = Math.floor(this.state.timerSeconds / 60);
    const durationSec = this.state.timerSeconds % 60;

    document.getElementById('visitDetailModal').classList.add('hidden');
    this.openPostVisitReport(this.state.activeRestaurant, { durationMin, durationSec });
  },

  openPostVisitReport(restaurant, visitMeta = {}) {
    const modal = document.getElementById('postVisitReportModal');
    if (!modal) return;

    document.getElementById('reportRestaurantName').textContent = restaurant.name;
    document.getElementById('reportRestaurantAddress').textContent = `${restaurant.commune} ${restaurant.zone || ''}, ${restaurant.address}`;
    document.getElementById('reportRestaurantId').textContent = `ID #${restaurant.id}`;
    document.getElementById('reportPhoto').src = restaurant.photo || 'assets/restaurant_placeholder.svg';

    const dm = restaurant.decision_maker || {};
    document.getElementById('reportContactName').value = dm.name || '';
    document.getElementById('reportContactRole').value = dm.role || 'Gérant';
    document.getElementById('reportContactPhone').value = dm.phone || restaurant.phone || '';

    const liveNotes = document.getElementById('fieldLiveNotes');
    const reportNotes = document.getElementById('reportNotesTextarea');
    if (liveNotes && reportNotes) {
      reportNotes.value = liveNotes.value || 'Contact établi sur le terrain.';
    }

    this.selectReportStatus('tres_interesse');
    this.selectReportAction('send_doc');

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  selectReportStatus(statusKey) {
    this.state.reportResult = statusKey;
    const container = document.getElementById('visitStatusGroup');
    if (!container) return;

    const allButtons = container.querySelectorAll('.status-option');
    allButtons.forEach(btn => {
      btn.classList.remove('bg-brand-dark', 'text-white', 'shadow-sm', 'ring-1', 'ring-brand-light');
      btn.classList.add('bg-stone-50', 'text-brand-text');
      const icon = btn.querySelector('.checkmark-icon');
      if (icon) icon.classList.add('opacity-0');
    });

    const activeBtn = container.querySelector(`[data-status="${statusKey}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('bg-stone-50', 'text-brand-text');
      activeBtn.classList.add('bg-brand-dark', 'text-white', 'shadow-sm', 'ring-1', 'ring-brand-light');
      const icon = activeBtn.querySelector('.checkmark-icon');
      if (icon) icon.classList.remove('opacity-0');
    }
  },

  selectReportAction(actionKey) {
    this.state.reportAction = actionKey;
    const container = document.getElementById('nextActionRow');
    if (!container) return;

    const buttons = container.querySelectorAll('.action-btn');
    buttons.forEach(btn => {
      btn.classList.remove('bg-brand-dark', 'text-white', 'shadow-sm', 'ring-1', 'ring-brand-light');
      btn.classList.add('bg-stone-50', 'text-brand-text');
    });

    const activeBtn = container.querySelector(`[data-action="${actionKey}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('bg-stone-50', 'text-brand-text');
      activeBtn.classList.add('bg-brand-dark', 'text-white', 'shadow-sm', 'ring-1', 'ring-brand-light');
    }
  },

  appendTag(tagText) {
    const textarea = document.getElementById('reportNotesTextarea');
    if (!textarea) return;
    textarea.value = textarea.value ? `${textarea.value} • ${tagText}` : tagText;
    if (navigator.vibrate) navigator.vibrate(20);
  },

  async submitVisitReport() {
    const restaurant = this.state.activeRestaurant;
    if (!restaurant) return;

    const submitBtn = document.getElementById('submitVisitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">sync</span> Enregistrement en cours...';
    }

    const payload = {
      restaurant_id: restaurant.id,
      result: this.state.reportResult,
      contact_name: document.getElementById('reportContactName')?.value || '',
      contact_role: document.getElementById('reportContactRole')?.value || '',
      contact_phone: document.getElementById('reportContactPhone')?.value || '',
      notes: document.getElementById('reportNotesTextarea')?.value || '',
      next_action: this.state.reportAction,
      follow_up_date: document.getElementById('reportFollowUpDate')?.value || 'Prochainement',
      agent: this.state.currentUser ? this.state.currentUser.name : 'Agent Commercial'
    };

    try {
      const res = await fetch('api.php?action=record_visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res.success) {
        await this.loadData();
        this.closeModalViews();
        this.showToast(`Visite enregistrée ! Nouveau statut : ${res.new_status === 'VISITE' ? 'VISITÉ' : 'À RELANCER'}`, 'success');
        if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
        this.navigateTo('restaurants');
      } else {
        alert('Erreur lors de l\'enregistrement : ' + (res.error || 'Veuillez réessayer'));
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau lors de l\'enregistrement.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>ENREGISTRER LA VISITE & CONTINUER</span><span class="material-symbols-outlined text-[22px]">arrow_forward</span>';
      }
    }
  },

  closeModalViews() {
    document.querySelectorAll('.fullscreen-modal').forEach(m => m.classList.add('hidden'));
    document.body.style.overflow = '';
    // Cleanup mini-map
    if (this.state.modalMiniMap) {
      this.state.modalMiniMap.remove();
      this.state.modalMiniMap = null;
      this.state.modalMiniMapMarker = null;
    }
  },

  // -------------------------------------------------------------
  // VUE 6 : PANNEAU D'ADMINISTRATION
  // -------------------------------------------------------------
  renderAdminTab() {
    if (!this.state.currentUser || this.state.currentUser.role !== 'ADMIN') {
      this.showToast('Accès réservé aux Administrateurs', 'error');
      this.navigateTo('accueil');
      return;
    }
    this.renderMainCommunesCheckboxes();
    this.renderAdminUsersList();
  },

  renderMainCommunesCheckboxes() {
    const container = document.getElementById('mainCommunesCheckboxes');
    if (!container) return;
    const communes = ['Cocody', 'Marcory', 'Plateau', 'Yopougon', 'Treichville', 'Koumassi', 'Port-Bouët'];
    container.innerHTML = communes.map(c => `
      <label class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-cream border border-brand-border text-xs font-bold text-brand-text cursor-pointer hover:bg-white transition-colors">
        <input type="checkbox" value="${c}" class="main-commune-checkbox rounded text-brand-light focus:ring-brand-light"/>
        <span>${c}</span>
      </label>
    `).join('');
  },

  async renderAdminUsersList() {
    const container = document.getElementById('mainAdminUsersListContainer');
    const badge = document.getElementById('mainAdminUsersCount');
    if (!container) return;

    try {
      const res = await fetch('api.php?action=users').then(r => r.json());
      if (!res.success) {
        container.innerHTML = `<div class="text-xs text-rose-600 font-bold">Erreur de chargement des utilisateurs</div>`;
        return;
      }
      const users = res.users || [];
      if (badge) badge.textContent = users.length;

      if (!users.length) {
        container.innerHTML = `<div class="text-center py-6 text-xs text-brand-muted font-medium">Aucun utilisateur enregistré.</div>`;
        return;
      }

      const COMMUNES_LIST = ['Cocody', 'Marcory', 'Plateau', 'Yopougon', 'Treichville', 'Koumassi', 'Port-Bouët'];

      container.innerHTML = users.map(u => {
        const assigned = u.assigned_communes || [];
        const isSelf = this.state.currentUser && u.id === this.state.currentUser.id;

        return `
          <div class="p-5 rounded-2xl bg-brand-cream border border-brand-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div class="flex items-start gap-3">
              <div class="w-11 h-11 rounded-2xl ${u.role === 'ADMIN' ? 'bg-brand-dark text-brand-light' : 'bg-brand-surface text-brand-text'} flex items-center justify-center font-extrabold text-sm flex-shrink-0 border border-brand-border">
                ${u.name.substring(0,2).toUpperCase()}
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="text-sm font-bold text-brand-text">${u.name}</h4>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${u.role === 'ADMIN' ? 'bg-brand-dark text-brand-light' : 'bg-amber-100 text-amber-900 border border-amber-300'}">
                    ${u.role}
                  </span>
                  ${isSelf ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Vous</span>' : ''}
                </div>
                <div class="text-xs text-brand-muted mt-0.5 flex items-center gap-3 flex-wrap">
                  <span>✉️ ${u.email}</span>
                  ${u.phone ? `<span>📞 ${u.phone}</span>` : ''}
                </div>

                <div class="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span class="text-[11px] font-bold text-brand-muted mr-1">Communes assignées :</span>
                  ${COMMUNES_LIST.map(c => {
                    const hasIt = assigned.includes(c);
                    return `
                      <button type="button" onclick="App.toggleMainUserCommune('${u.id}', '${c}')"
                        class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${hasIt ? 'bg-emerald-700 text-white shadow-sm' : 'bg-white border border-brand-border text-brand-muted hover:bg-brand-surface'}">
                        ${hasIt ? '✓ ' : ''}${c}
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap border-t md:border-t-0 pt-3 md:pt-0 border-brand-border justify-end">
              <button onclick="App.resetMainUserPassword('${u.id}', '${u.name}')" type="button" class="px-3 py-1.5 rounded-xl bg-white border border-brand-border hover:bg-brand-surface text-brand-text text-xs font-bold transition-all shadow-sm flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px] text-amber-600">key</span>
                <span>Réinit. mot de passe</span>
              </button>
              ${!isSelf ? `
                <button onclick="App.toggleMainUserRole('${u.id}', '${u.role}')" type="button" class="px-3 py-1.5 rounded-xl bg-white border border-brand-border hover:bg-brand-surface text-brand-text text-xs font-bold transition-all shadow-sm">
                  Passer en ${u.role === 'ADMIN' ? 'AGENT' : 'ADMIN'}
                </button>
                <button onclick="App.deleteMainUser('${u.id}', '${(u.name || '').replace(/'/g, "\\'")}', this)" type="button" class="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all flex items-center gap-1" title="Supprimer le membre">
                  <span class="material-symbols-outlined text-[18px] pointer-events-none">delete</span>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async handleMainCreateUserSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }

    const name = document.getElementById('mainNewUserName').value.trim();
    const email = document.getElementById('mainNewUserEmail').value.trim();
    const role = document.getElementById('mainNewUserRole').value;
    const customPass = document.getElementById('mainNewUserCustomPass')?.value.trim() || '';

    const selectedCommunes = Array.from(document.querySelectorAll('.main-commune-checkbox:checked')).map(cb => cb.value);

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
        document.getElementById('mainCredEmail').textContent = res.user.email;
        document.getElementById('mainCredPass').textContent = res.generated_password;
        document.getElementById('mainAdminCredentialsAlert').classList.remove('hidden');

        e.target.reset();
        this.renderMainCommunesCheckboxes();
        await this.renderAdminUsersList();
        this.showToast(`Membre ${name} créé avec succès !`, 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert('⚠️ ' + (res.error || 'Erreur lors de la création du membre'));
      }
    } catch (err) {
      alert('Erreur réseau lors de la création du membre.');
    } finally {
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
  },

  copyMainAdminCredentials() {
    const email = document.getElementById('mainCredEmail').textContent;
    const pass = document.getElementById('mainCredPass').textContent;
    const text = `Identifiants Menu Scan :\n- Email : ${email}\n- Mot de passe : ${pass}\n- Lien : ${window.location.origin}/index.php`;

    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Identifiants copiés dans le presse-papier !', 'success');
    });
  },

  async toggleMainUserCommune(userId, commune) {
    try {
      const res = await fetch('api.php?action=toggle_user_commune', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: userId, commune })
      }).then(r => r.json());

      if (res.success) {
        await this.renderAdminUsersList();
      } else {
        alert(res.error || 'Erreur');
      }
    } catch (e) {
      alert('Erreur réseau');
    }
  },

  async resetMainUserPassword(userId, userName) {
    try {
      const res = await fetch('api.php?action=reset_user_password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: userId })
      }).then(r => r.json());

      if (res.success) {
        const resUsers = await fetch('api.php?action=users').then(r => r.json());
        const user = (resUsers.users || []).find(u => u.id === userId);

        document.getElementById('mainCredEmail').textContent = user ? user.email : '';
        document.getElementById('mainCredPass').textContent = res.new_password;
        document.getElementById('mainAdminCredentialsAlert').classList.remove('hidden');
        this.showToast(`Nouveau mot de passe généré pour ${userName} !`, 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert(res.error || 'Erreur lors de la réinitialisation');
      }
    } catch (e) {
      alert('Erreur réseau');
    }
  },

  async toggleMainUserRole(userId, currentRole) {
    const newRole = currentRole === 'ADMIN' ? 'AGENT' : 'ADMIN';
    try {
      const res = await fetch('api.php?action=update_user_role', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: userId, role: newRole })
      }).then(r => r.json());

      if (res.success) {
        await this.renderAdminUsersList();
        this.showToast('Rôle mis à jour', 'success');
      } else {
        alert(res.error || 'Erreur');
      }
    } catch (e) {
      alert('Erreur réseau');
    }
  },

  pendingDeleteUser: null,

  async deleteMainUser(userId, userName, btnElement) {
    if (this.pendingDeleteUser !== userId) {
      this.pendingDeleteUser = userId;
      if (btnElement) {
        btnElement.className = "px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1 animate-pulse";
        btnElement.innerHTML = `<span class="material-symbols-outlined text-[16px] pointer-events-none">warning</span><span>Confirmer ?</span>`;
      }
      setTimeout(() => {
        if (this.pendingDeleteUser === userId) {
          this.pendingDeleteUser = null;
          if (btnElement) {
            btnElement.className = "p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all flex items-center gap-1";
            btnElement.innerHTML = `<span class="material-symbols-outlined text-[18px] pointer-events-none">delete</span>`;
          }
        }
      }, 4000);
      return;
    }

    this.pendingDeleteUser = null;
    try {
      const res = await fetch('api.php?action=delete_user', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: userId })
      }).then(r => r.json());

      if (res.success) {
        await this.loadData();
        await this.renderAdminUsersList();
        this.showToast('Membre supprimé avec succès', 'success');
      } else {
        alert(res.error || 'Erreur lors de la suppression');
      }
    } catch (e) {
      alert('Erreur réseau');
    }
  },

  showToast(message, type = 'info') {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;

    const toastText = document.getElementById('toastText');
    const toastIcon = document.getElementById('toastIcon');

    if (toastText) toastText.textContent = message;
    if (toastIcon) {
      toastIcon.textContent = type === 'success' ? 'check_circle' : 'info';
      toastIcon.className = `material-symbols-outlined text-[20px] ${type === 'success' ? 'text-emerald-400' : 'text-brand-light'}`;
    }

    toast.classList.remove('translate-y-24', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-24', 'opacity-0');
    }, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
