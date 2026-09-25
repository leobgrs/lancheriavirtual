import QRCodeLib from 'qrcode';
import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, limit, getDocs, deleteDoc, serverTimestamp, doc } from "firebase/firestore";

document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // REFERÊNCIAS DOM
    // ============================================================
    const queueList = document.getElementById('queue-list');
    const historyList = document.getElementById('history-list');
    const addForm = document.getElementById('add-form');
    const nameInput = document.getElementById('name');
    const whatsappInput = document.getElementById('whatsapp');
    const lancheInput = document.getElementById('add-lanche');
    const bebidaInput = document.getElementById('add-bebida');
    const qrcodeContainer = document.getElementById('qrcode');
    const emptyQueueMessage = document.getElementById('empty-queue-message');
    const callNextBtn = document.getElementById('call-next-btn');

    const statTotalAtendidos = document.getElementById('stat-total-atendidos');
    const statTopLanche = document.getElementById('stat-top-lanche');

    const soundControlBar = document.getElementById('sound-control-bar');
    const soundIcon = document.getElementById('sound-icon');
    const soundText = document.getElementById('sound-text');
    const toastEl = document.getElementById('toast');

    // ============================================================
    // 🚨 V4.2 — BANNER DE "SAIU DA ABA" COM RESET DE ANIMAÇÃO
    // ============================================================
    const BANNER_DURATION = 10000; // 10 segundos
    let awayBannerTimeout = null;

    const awayBanner = document.createElement('div');
    awayBanner.id = 'away-banner';
    awayBanner.innerHTML = `
        <div class="away-banner-content">
            <div class="away-banner-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="away-banner-text">
                <strong id="away-banner-title">⚠️ Você saiu do painel!</strong>
                <span id="away-banner-subtitle">O alarme pode não funcionar em segundo plano. Volte para esta aba.</span>
                <span class="away-banner-hint">Clique para fechar</span>
            </div>
            <div class="away-banner-count hidden" id="away-banner-count">
                <span id="away-banner-count-number">0</span>
                <small>pedido(s)</small>
            </div>
        </div>
    `;

    const awayBannerStyle = document.createElement('style');
    awayBannerStyle.textContent = `
        #away-banner {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 99999;
            background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);
            color: #fff;
            padding: 18px 24px 22px 24px;
            font-family: 'Inter', sans-serif;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
            transform: translateY(-120%);
            transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            justify-content: center;
            pointer-events: none;
            overflow: hidden;
        }
        #away-banner.show { 
            transform: translateY(0); 
            pointer-events: auto; 
            cursor: pointer; 
        }
        
        /* Barra de progresso GROSSA no fundo do banner */
        #away-banner::after {
            content: '';
            position: absolute;
            bottom: 0; left: 0;
            height: 8px;
            background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #ef4444 100%);
            width: 0%;
            transition: width 10s linear;
            box-shadow: 0 0 12px rgba(251, 191, 36, 0.6);
        }
        #away-banner.show::after {
            width: 100%;
        }
        
        /* Pulso no banner inteiro */
        @keyframes bannerFlash {
            0%, 100% { box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 0 rgba(255,255,255,0); }
            50% { box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), inset 0 0 60px 0 rgba(255,255,255,0.06); }
        }
        #away-banner.show {
            animation: bannerFlash 2s ease-in-out infinite;
        }
        
        .away-banner-content {
            display: flex;
            align-items: center;
            gap: 18px;
            max-width: 900px;
            width: 100%;
        }
        .away-banner-icon {
            width: 54px; height: 54px;
            background: rgba(255,255,255,0.18);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.7rem;
            animation: awayPulse 1.2s infinite;
            flex-shrink: 0;
            color: #fca5a5;
        }
        @keyframes awayPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,255,255,0.6); }
            50% { transform: scale(1.1); box-shadow: 0 0 0 16px rgba(255,255,255,0); }
        }
        .away-banner-text {
            flex: 1;
            text-align: left;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .away-banner-text strong {
            font-size: 1.05rem;
            font-weight: 700;
            letter-spacing: -0.01em;
            line-height: 1.3;
        }
        .away-banner-text span {
            font-size: 0.85rem;
            opacity: 0.9;
            line-height: 1.4;
        }
        .away-banner-hint {
            font-size: 0.72rem;
            opacity: 0.65;
            margin-top: 6px;
            font-style: italic;
        }
        .away-banner-count {
            background: rgba(255,255,255,0.22);
            padding: 10px 18px;
            border-radius: 14px;
            display: flex;
            flex-direction: column;
            align-items: center;
            flex-shrink: 0;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.15);
        }
        .away-banner-count.hidden { display: none; }
        .away-banner-count span {
            font-family: 'Poppins', sans-serif;
            font-size: 1.6rem;
            font-weight: 800;
            line-height: 1;
        }
        .away-banner-count small {
            font-size: 0.68rem;
            opacity: 0.9;
            margin-top: 3px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }

        @media (max-width: 600px) {
            #away-banner { padding: 14px 16px 18px 16px; }
            .away-banner-icon { width: 44px; height: 44px; font-size: 1.3rem; }
            .away-banner-text strong { font-size: 0.92rem; }
            .away-banner-text span { font-size: 0.76rem; }
            .away-banner-count { padding: 8px 14px; }
            .away-banner-count span { font-size: 1.3rem; }
        }
    `;
    document.head.appendChild(awayBannerStyle);
    document.body.appendChild(awayBanner);

    // Clicar no banner esconde imediatamente
    awayBanner.addEventListener('click', () => {
        awayBanner.classList.remove('show');
        if (awayBannerTimeout) {
            clearTimeout(awayBannerTimeout);
            awayBannerTimeout = null;
        }
        const countEl = document.getElementById('away-banner-count');
        if (countEl) countEl.classList.add('hidden');
        pendingOrdersWhileAway = 0;
    });

    // ============================================================
    // 🔊 SISTEMA DE ÁUDIO BLINDADO — V4.2
    // ============================================================
    let audioCtx = null;
    let soundEnabled = false;
    let watchdogInterval = null;
    let silentKeepAlive = null;
    let wakeLock = null;
    let pendingAlert = false;
    let isAway = false;
    let pendingOrdersWhileAway = 0;

    // ---------- TOAST ----------
    function showToast(message, type = 'info', duration = 4000) {
        if (!toastEl) return;
        toastEl.className = '';
        toastEl.classList.add('show');
        if (type === 'warning') toastEl.classList.add('warning-toast');
        if (type === 'error') toastEl.classList.add('error-toast');
        if (type === 'success') toastEl.classList.add('success-toast');

        let icon = 'fa-info-circle';
        if (type === 'warning') icon = 'fa-exclamation-triangle';
        if (type === 'error') icon = 'fa-times-circle';
        if (type === 'success') icon = 'fa-check-circle';

        toastEl.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;

        clearTimeout(toastEl._timeout);
        toastEl._timeout = setTimeout(() => {
            toastEl.classList.remove('show');
        }, duration);
    }

    // ---------- INICIALIZAÇÃO DO AudioContext ----------
    function unlockAudio() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            return true;
        } catch (e) {
            console.error('Erro ao inicializar AudioContext:', e);
            return false;
        }
    }

    // ---------- OSCILADOR SILENCIOSO ----------
    function startSilentKeepAlive() {
        if (!audioCtx || silentKeepAlive) return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            gain.gain.value = 0;
            osc.frequency.value = 20;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            silentKeepAlive = { osc, gain };
            console.log('🔇 Oscilador silencioso iniciado');
        } catch (e) {
            console.warn('Erro ao criar oscilador silencioso:', e);
        }
    }

    function stopSilentKeepAlive() {
        if (silentKeepAlive) {
            try {
                silentKeepAlive.osc.stop();
                silentKeepAlive.osc.disconnect();
                silentKeepAlive.gain.disconnect();
            } catch (e) {}
            silentKeepAlive = null;
            console.log('🔇 Oscilador silencioso parado');
        }
    }

    // ---------- WAKE LOCK ----------
    async function requestWakeLock() {
        if (!('wakeLock' in navigator)) {
            console.log('ℹ️ Wake Lock não suportado');
            return;
        }
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('🔓 Wake Lock liberado');
            });
            console.log('🔒 Wake Lock ativo');
        } catch (e) {
            console.warn('Erro ao adquirir Wake Lock:', e);
        }
    }

    async function releaseWakeLock() {
        if (wakeLock) {
            try { await wakeLock.release(); } catch (e) {}
            wakeLock = null;
        }
    }

    // ---------- GERAÇÃO DE BIPES ----------
    function playBeep(type = 'new') {
        if (!soundEnabled) return;
        if (!unlockAudio()) return;

        if (audioCtx.state !== 'running') {
            pendingAlert = true;
            console.log('⚠️ Áudio suspenso — alerta guardado');
            return;
        }

        const now = audioCtx.currentTime;
        let frequencies = [];
        let durations = [];
        const gainValue = 0.5;

        if (type === 'new') {
            frequencies = [880, 1320, 880];
            durations = [0.15, 0.15, 0.25];
        } else if (type === 'call') {
            frequencies = [660, 880, 1100];
            durations = [0.12, 0.12, 0.25];
        } else if (type === 'remove') {
            frequencies = [600, 400];
            durations = [0.1, 0.15];
        }

        let startTime = now;
        frequencies.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durations[i]);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(startTime);
            osc.stop(startTime + durations[i] + 0.02);

            startTime += durations[i] + 0.05;
        });

        if (navigator.vibrate) {
            navigator.vibrate(type === 'new' ? [150, 80, 150] : [80, 40, 80]);
        }
    }

    // ---------- UI DA BARRA DE SOM ----------
    function updateSoundBarUI() {
        if (!soundControlBar) return;

        if (!soundEnabled) {
            soundControlBar.classList.add('warning');
            soundControlBar.style.background = '#7f1d1d';
            soundControlBar.style.color = '#fecaca';
            if (soundIcon) {
                soundIcon.className = 'fas fa-volume-mute';
                soundIcon.style.color = '#fca5a5';
            }
            if (soundText) soundText.textContent = '🔕 ALARME DESATIVADO — CLIQUE AQUI PARA ATIVAR';
            return;
        }

        if (audioCtx && audioCtx.state === 'running') {
            soundControlBar.classList.remove('warning');
            soundControlBar.style.background = '#d4edda';
            soundControlBar.style.color = '#155724';
            if (soundIcon) {
                soundIcon.className = 'fas fa-volume-up';
                soundIcon.style.color = '#1cc88a';
            }
            if (soundText) soundText.textContent = '🔔 ALARME ATIVO — Sistema a funcionar normalmente';
        } else {
            soundControlBar.classList.add('warning');
            soundControlBar.style.background = '#78350f';
            soundControlBar.style.color = '#fde68a';
            if (soundIcon) {
                soundIcon.className = 'fas fa-exclamation-triangle';
                soundIcon.style.color = '#fbbf24';
            }
            if (soundText) soundText.textContent = '⚠️ ÁUDIO SUSPENSO — CLIQUE PARA REATIVAR';
        }
    }

    // ---------- RETOMADA DE ÁUDIO ----------
    async function tryResumeAudio() {
        if (!soundEnabled || !audioCtx) return;
        if (audioCtx.state === 'suspended') {
            try {
                await audioCtx.resume();
                console.log('✅ Áudio retomado');
                updateSoundBarUI();

                if (pendingAlert) {
                    pendingAlert = false;
                    console.log('🔔 Tocando alerta pendente');
                    setTimeout(() => playBeep('new'), 200);
                }
            } catch (e) {
                console.warn('Falha ao retomar áudio:', e);
            }
        }
    }

    // ---------- TOGGLE DO SOM ----------
    if (soundControlBar) {
        const toggleSound = async () => {
            const ok = unlockAudio();
            if (!ok) {
                showToast('O seu navegador não suporta áudio.', 'error');
                return;
            }

            soundEnabled = !soundEnabled;

            if (soundEnabled) {
                if (audioCtx.state === 'suspended') {
                    await audioCtx.resume();
                }
                playBeep('new');
                updateSoundBarUI();
                showToast('Alarme ativado! ⚠️ Mantenha esta aba SEMPRE visível.', 'success', 6000);
                startSilentKeepAlive();
                startWatchdog();
                requestWakeLock();
            } else {
                stopWatchdog();
                stopSilentKeepAlive();
                releaseWakeLock();
                updateSoundBarUI();
                showToast('Alarme sonoro desativado.', 'warning', 2500);
            }
        };

        soundControlBar.addEventListener('click', toggleSound);
        soundControlBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSound();
            }
        });
    }

    // ---------- WATCHDOG ----------
    function startWatchdog() {
        stopWatchdog();
        watchdogInterval = setInterval(async () => {
            if (!soundEnabled) return;

            if (audioCtx && audioCtx.state === 'suspended') {
                console.log('🐕 Watchdog: áudio suspenso, tentando retomar...');
                await tryResumeAudio();
            } else if (audioCtx && audioCtx.state === 'running') {
                try {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    gain.gain.value = 0.0001;
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start();
                    osc.stop(audioCtx.currentTime + 0.05);
                } catch (e) {}
            }
            updateSoundBarUI();
        }, 10000);
    }

    function stopWatchdog() {
        if (watchdogInterval) {
            clearInterval(watchdogInterval);
            watchdogInterval = null;
        }
    }

    // ---------- RETOMADA EM MÚLTIPLOS EVENTOS ----------
    ['click', 'keydown', 'touchstart', 'mousedown', 'pointerdown'].forEach(evt => {
        document.addEventListener(evt, () => {
            if (soundEnabled && audioCtx && audioCtx.state === 'suspended') {
                tryResumeAudio();
            }
        }, { passive: true });
    });

    // ============================================================
    // DETECÇÃO DE SAÍDA / VOLTA À ABA (V4.2 — COM RESET DE ANIMAÇÃO)
    // ============================================================
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // ===== OPERADOR SAIU DA ABA =====
            isAway = true;
            console.log('👋 Operador saiu da aba');

            // 🔧 CORRIGIDO: Força reset da animação CSS
            awayBanner.classList.remove('show');
            void awayBanner.offsetWidth;   // força reflow (bug fix da barra de progresso)
            awayBanner.classList.add('show');

            if (awayBannerTimeout) {
                clearTimeout(awayBannerTimeout);
                awayBannerTimeout = null;
            }

        } else {
            // ===== OPERADOR VOLTOU À ABA =====
            isAway = false;
            console.log('👁️ Operador voltou à aba');

            tryResumeAudio();

            if (soundEnabled && !wakeLock) {
                requestWakeLock();
            }

            // Se chegaram pedidos enquanto estava fora
            if (pendingOrdersWhileAway > 0) {
                const count = pendingOrdersWhileAway;
                pendingOrdersWhileAway = 0;

                const titleEl = document.getElementById('away-banner-title');
                const subtitleEl = document.getElementById('away-banner-subtitle');
                if (titleEl) titleEl.textContent = `⚠️ ${count} pedido(s) chegaram enquanto você estava fora!`;
                if (subtitleEl) subtitleEl.textContent = 'Verifique a fila e chame o próximo.';

                setTimeout(() => {
                    showToast(`⚠️ ${count} pedido(s) chegaram enquanto você estava fora!`, 'error', 8000);
                    setTimeout(() => playBeep('new'), 300);
                }, 400);

                const countEl = document.getElementById('away-banner-count');
                if (countEl) countEl.classList.add('hidden');
            }

            // 🔧 CORRIGIDO: Reaplica o reflow para reiniciar a barra de progresso
            awayBanner.classList.remove('show');
            void awayBanner.offsetWidth;
            awayBanner.classList.add('show');

            if (awayBannerTimeout) clearTimeout(awayBannerTimeout);
            console.log(`⏱️ Agendando fecho em ${BANNER_DURATION}ms (${BANNER_DURATION/1000}s)`);

            awayBannerTimeout = setTimeout(() => {
                console.log('🔚 Fechando banner');
                awayBanner.classList.remove('show');

                const titleEl = document.getElementById('away-banner-title');
                const subtitleEl = document.getElementById('away-banner-subtitle');
                if (titleEl) titleEl.textContent = '⚠️ Você saiu do painel!';
                if (subtitleEl) subtitleEl.textContent = 'O alarme pode não funcionar em segundo plano. Volte para esta aba.';
            }, BANNER_DURATION);
        }
    });

    window.addEventListener('focus', () => {
        console.log('🪟 Janela ganhou foco');
        tryResumeAudio();
    });

    // ---------- INCREMENTA PEDIDOS FORA DA ABA ----------
    function incrementAwayOrders() {
        pendingOrdersWhileAway++;
        const countEl = document.getElementById('away-banner-count');
        const numberEl = document.getElementById('away-banner-count-number');

        if (countEl && numberEl) {
            numberEl.textContent = pendingOrdersWhileAway;
            countEl.classList.remove('hidden');
        }

        // 🔧 CORRIGIDO: Cancela o timer de auto-fecho se há pedidos pendentes
        // (o banner fica até o operador clicar)
        if (awayBannerTimeout) {
            clearTimeout(awayBannerTimeout);
            awayBannerTimeout = null;
        }

        if (isAway && soundEnabled) {
            try {
                if (audioCtx && audioCtx.state === 'running') {
                    playBeep('new');
                    console.log('🔔 Bipe tocado mesmo com operador fora da aba!');
                } else {
                    console.log('⚠️ Áudio suspenso — pedido será notificado ao voltar');
                }
            } catch (e) {}
        }
    }

    // Estado inicial
    updateSoundBarUI();

    // ============================================================
    // FIM DO SISTEMA DE ÁUDIO V4.2
    // ============================================================


    // ============================================================
    // FIREBASE — REFERÊNCIAS
    // ============================================================
    const queueCollection = collection(db, "queue");
    const historyCollection = collection(db, "history");

    // ============================================================
    // PAGINAÇÃO
    // ============================================================
    let currentPage = 1;
    const itemsPerPage = 10;
    let allPeople = [];

    // ============================================================
    // RENDERIZAÇÃO DA FILA
    // ============================================================
    const renderQueue = (people) => {
        allPeople = people;
        if (!queueList) return;

        queueList.innerHTML = '';
        const paginationControls = document.getElementById('pagination-controls');
        if (paginationControls) paginationControls.innerHTML = '';

        if (callNextBtn) callNextBtn.disabled = people.length === 0;

        if (people.length === 0) {
            if (emptyQueueMessage) emptyQueueMessage.style.display = 'block';
            return;
        }

        if (emptyQueueMessage) emptyQueueMessage.style.display = 'none';

        const totalPages = Math.ceil(people.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = totalPages || 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedPeople = people.slice(startIndex, endIndex);

        paginatedPeople.forEach((person, index) => {
            const actualPosition = startIndex + index + 1;

            const li = document.createElement('li');
            li.className = 'queue-item';
            li.dataset.id = person.id;

            li.innerHTML = `
                <div class="person-info" style="display: flex; align-items: center; width: 100%;">
                    <span class="person-position">${actualPosition}º</span>
                    <div class="person-details" style="flex: 1;">
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">
                            ${person.name} <span style="font-size: 0.85rem; font-weight: 400; color: var(--text-muted); margin-left: 10px;"><i class="fab fa-whatsapp" style="color: #25d366;"></i> ${person.whatsapp}</span>
                        </div>
                        <div style="background: var(--surface-2); border-left: 4px solid var(--primary); padding: 8px 12px; margin-top: 6px; border-radius: 6px; font-size: 0.95rem; color: var(--text-secondary);">
                            🍔 <strong>Pedido:</strong> <span style="color: var(--primary); font-weight: 600;">${person.lanche || 'Não informado'}</span> + <span style="color: var(--text-secondary);">${person.bebida || 'Sem bebida'}</span>
                        </div>
                    </div>
                </div>
                <div class="actions" style="margin-left: 15px;">
                    <button class="btn-remove" title="Remover da Fila"><i class="fas fa-times-circle"></i></button>
                </div>
            `;
            queueList.appendChild(li);
        });

        if (totalPages > 1 && paginationControls) {
            const btnPrev = document.createElement('button');
            btnPrev.className = 'page-btn';
            btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
            btnPrev.disabled = currentPage === 1;
            btnPrev.onclick = () => { currentPage--; renderQueue(allPeople); };
            paginationControls.appendChild(btnPrev);

            for (let i = 1; i <= totalPages; i++) {
                const btnPage = document.createElement('button');
                btnPage.className = `page-btn ${i === currentPage ? 'active' : ''}`;
                btnPage.textContent = i;
                btnPage.onclick = () => { currentPage = i; renderQueue(allPeople); };
                paginationControls.appendChild(btnPage);
            }

            const btnNext = document.createElement('button');
            btnNext.className = 'page-btn';
            btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
            btnNext.disabled = currentPage === totalPages;
            btnNext.onclick = () => { currentPage++; renderQueue(allPeople); };
            paginationControls.appendChild(btnNext);
        }
    };

    // ============================================================
    // RENDERIZAÇÃO DO HISTÓRICO + ESTATÍSTICAS
    // ============================================================
    const renderHistory = (historyDocs) => {
        if (!historyList) return;
        historyList.innerHTML = '';

        if (statTotalAtendidos) {
            statTotalAtendidos.textContent = historyDocs.length;
        }

        if (historyDocs.length > 0 && statTopLanche) {
            const lanchesCount = {};
            historyDocs.forEach(item => {
                const l = item.lanche || 'Desconhecido';
                lanchesCount[l] = (lanchesCount[l] || 0) + 1;
            });
            let top = Object.keys(lanchesCount)[0];
            let max = lanchesCount[top];
            for (let l in lanchesCount) {
                if (lanchesCount[l] > max) {
                    max = lanchesCount[l];
                    top = l;
                }
            }
            statTopLanche.textContent = top;
        } else if (statTopLanche) {
            statTopLanche.textContent = '--';
        }

        if (historyDocs.length === 0) {
            historyList.innerHTML = `
                <li style="justify-content: center; color: var(--text-muted); padding: 25px; border-left: none; background: transparent; box-shadow: none;">
                    Nenhum pedido concluído recentemente nesta sessão.
                </li>
            `;
        } else {
            historyDocs.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div style="width: 100%;">
                        <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">
                            ${item.name} <span style="font-weight: 400; font-size: 0.85rem; color: var(--text-muted); margin-left: 10px;"><i class="fab fa-whatsapp"></i> ${item.whatsapp}</span>
                        </div>
                        <div style="background: var(--surface-2); border-left: 4px solid var(--success); padding: 6px 10px; margin-top: 5px; border-radius: 4px; font-size: 0.9rem; color: var(--text-secondary);">
                            ✅ <strong>Entregue:</strong> <span style="font-weight: 600; color: var(--text-primary);">${item.lanche || 'Lanche'} + ${item.bebida || ''}</span>
                        </div>
                    </div>
                `;
                historyList.appendChild(li);
            });
        }
    };

    // ============================================================
    // ESCUTA EM TEMPO REAL DO FIREBASE
    // ============================================================
    let isInitialLoad = true;
    let knownIds = new Set();

    const qQueue = query(queueCollection, orderBy("timestamp", "asc"));

    onSnapshot(qQueue, (snapshot) => {
        const people = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const currentIds = new Set(people.map(p => p.id));

        if (!isInitialLoad) {
            let newCount = 0;
            currentIds.forEach(id => {
                if (!knownIds.has(id)) newCount++;
            });

            if (newCount > 0) {
                if (soundEnabled) {
                    console.log('🔔 Novo pedido detectado — tocando alarme');
                    playBeep('new');
                    showToast(`🔔 ${newCount} novo(s) pedido(s) na fila!`, 'success', 4000);
                } else {
                    showToast(`🔔 ${newCount} novo(s) pedido(s) na fila! (Som desligado)`, 'warning', 6000);
                }

                if (isAway) {
                    incrementAwayOrders();
                }
            }
        }

        knownIds = currentIds;
        renderQueue(people);
        isInitialLoad = false;
    });

    const qHistory = query(historyCollection, limit(20));
    onSnapshot(qHistory, (snapshot) => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderHistory(history);
    });

    // ============================================================
    // ADICIONAR PESSOA MANUALMENTE
    // ============================================================
    const addPerson = async (name, whatsapp, lanche, bebida) => {
        if (name && whatsapp) {
            try {
                await addDoc(queueCollection, {
                    name: name,
                    whatsapp: whatsapp,
                    lanche: lanche || 'X-Burger',
                    bebida: bebida || 'Sem bebida',
                    timestamp: serverTimestamp()
                });
            } catch (error) {
                console.error("Erro ao adicionar:", error);
                showToast('Erro ao adicionar à fila.', 'error');
            }
        }
    };

    if (addForm) {
        addForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addPerson(
                nameInput.value.trim(),
                whatsappInput.value.trim(),
                lancheInput ? lancheInput.value : 'X-Burger',
                bebidaInput ? bebidaInput.value : 'Sem bebida'
            );
            addForm.reset();
        });
    }

    // ============================================================
    // REMOVER DA FILA
    // ============================================================
    if (queueList) {
        queueList.addEventListener('click', (e) => {
            const removeButton = e.target.closest('.btn-remove');
            if (removeButton) {
                const li = e.target.closest('.queue-item');
                const personId = li.dataset.id;
                if (confirm("Tem certeza que deseja remover este pedido da lista?")) {
                    deleteDoc(doc(db, "queue", personId)).then(() => {
                        playBeep('remove');
                    }).catch(error => {
                        console.error("Erro ao remover:", error);
                        showToast('Erro ao remover o pedido.', 'error');
                    });
                }
            }
        });
    }

    // ============================================================
    // CHAMAR PRÓXIMO
    // ============================================================
    if (callNextBtn) {
        callNextBtn.addEventListener('click', async () => {
            const asArray = Array.from(queueList.children);
            if (asArray.length === 0) {
                alert("A fila está vazia.");
                return;
            }

            const firstInQueueQuery = query(queueCollection, orderBy("timestamp", "asc"), limit(1));
            const snapshot = await getDocs(firstInQueueQuery);

            if (!snapshot.empty) {
                const nextPersonDoc = snapshot.docs[0];
                const person = { id: nextPersonDoc.id, ...nextPersonDoc.data() };

                const numeroLimpo = person.whatsapp.replace(/\D/g, '');
                const lancheDesc = person.lanche || 'Lanche';
                const bebidaDesc = person.bebida || '';
                const mensagem = `Olá ${person.name}, o seu pedido (${lancheDesc} + ${bebidaDesc}) na Lancheria está pronto! Por favor, dirija-se ao balcão para retirada. Bom apetite! 🍔🥤`;

                const whatsappUrl = `https://wa.me/${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;

                window.open(whatsappUrl, '_blank');
                playBeep('call');

                const listItem = queueList.querySelector(`[data-id="${person.id}"]`);
                if (listItem) {
                    listItem.classList.add('calling');
                }

                setTimeout(async () => {
                    try {
                        await addDoc(historyCollection, {
                            name: person.name,
                            whatsapp: person.whatsapp,
                            lanche: person.lanche || 'Lanche',
                            bebida: person.bebida || '',
                            timestamp: serverTimestamp()
                        });
                        await deleteDoc(doc(db, "queue", person.id));
                    } catch (error) {
                        console.error("Erro ao mover para o histórico:", error);
                        showToast('Erro ao mover para o histórico.', 'error');
                    }
                }, 2000);
            }
        });
    }

    // ============================================================
    // GERAR QR CODE
    // ============================================================
    const generateQRCode = () => {
        if (!qrcodeContainer) return;
        const currentUrl = window.location.href.split('?')[0];
        const joinUrl = currentUrl.replace('index.html', '').replace(/\/$/, '') + '/join.html';

        QRCodeLib.toCanvas(document.createElement('canvas'), joinUrl, { width: 256, errorCorrectionLevel: 'H' }, (err, canvas) => {
            if (err) throw err;
            qrcodeContainer.innerHTML = '';
            qrcodeContainer.appendChild(canvas);
        });
    };

    generateQRCode();
});
