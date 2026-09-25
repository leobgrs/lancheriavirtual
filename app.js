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
    // 🔊 SISTEMA DE ÁUDIO BLINDADO COM WEB AUDIO API
    // ============================================================
    let audioCtx = null;
    let soundEnabled = false;
    let watchdogInterval = null;

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

    // ---------- GERAÇÃO DE BIPES ----------
    function playBeep(type = 'new') {
        if (!soundEnabled) return;
        if (!unlockAudio()) return;
        if (audioCtx.state !== 'running') return;

        const now = audioCtx.currentTime;
        let frequencies = [];
        let durations = [];
        const gainValue = 0.4;

        if (type === 'new') {
            frequencies = [880, 1320];
            durations = [0.15, 0.2];
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
            navigator.vibrate(type === 'new' ? [100, 50, 100] : [80, 40, 80]);
        }
    }

    // ---------- ATUALIZAÇÃO VISUAL DA BARRA DE SOM ----------
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
            if (soundText) soundText.textContent = '⚠️ ÁUDIO SUSPENSO PELO NAVEGADOR — CLIQUE PARA REATIVAR';
        }
    }

    // ---------- TOGGLE DO SOM ----------
    if (soundControlBar) {
        const toggleSound = () => {
            const ok = unlockAudio();
            if (!ok) {
                showToast('O seu navegador não suporta áudio. Verifique as permissões do site.', 'error');
                return;
            }

            soundEnabled = !soundEnabled;

            if (soundEnabled) {
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume().then(() => {
                        playBeep('new');
                        updateSoundBarUI();
                        showToast('Alarme sonoro ativado com sucesso!', 'success');
                    });
                } else {
                    playBeep('new');
                    updateSoundBarUI();
                    showToast('Alarme sonoro ativado com sucesso!', 'success');
                }
                startWatchdog();
            } else {
                stopWatchdog();
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

    // ---------- WATCHDOG (verifica áudio a cada 5s) ----------
    function startWatchdog() {
        stopWatchdog();
        watchdogInterval = setInterval(() => {
            if (!soundEnabled) return;

            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().then(() => {
                    console.log('🔊 AudioContext reativado automaticamente pelo watchdog');
                    updateSoundBarUI();
                }).catch(() => {
                    updateSoundBarUI();
                });
            } else {
                updateSoundBarUI();
            }
        }, 5000);
    }

    function stopWatchdog() {
        if (watchdogInterval) {
            clearInterval(watchdogInterval);
            watchdogInterval = null;
        }
    }

    // ---------- RETOMA ÁUDIO AO VOLTAR O FOCO ----------
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && soundEnabled && audioCtx) {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().then(() => {
                    console.log('🔊 AudioContext retomado após voltar ao foco');
                    updateSoundBarUI();
                }).catch(() => updateSoundBarUI());
            } else {
                updateSoundBarUI();
            }
        }
    });

    // Estado inicial da barra
    updateSoundBarUI();

    // ============================================================
    // FIM DO SISTEMA DE ÁUDIO
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
                    <span class="person-position" style="font-size: 1.3rem; font-weight: 700; color: var(--primary); margin-right: 15px; min-width: 35px;">${actualPosition}º</span>
                    <div class="person-details" style="flex: 1;">
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--heading-color);">
                            ${person.name} <span style="font-size: 0.85rem; font-weight: 400; color: #666; margin-left: 10px;"><i class="fab fa-whatsapp" style="color: #25d366;"></i> ${person.whatsapp}</span>
                        </div>
                        <div style="background: #f1f3f9; border-left: 4px solid var(--primary); padding: 8px 12px; margin-top: 6px; border-radius: 6px; font-size: 0.95rem; color: #333;">
                            🍔 <strong>Pedido:</strong> <span style="color: var(--primary-dark); font-weight: 600;">${person.lanche || 'Não informado'}</span> + <span style="color: #555;">${person.bebida || 'Sem bebida'}</span>
                        </div>
                    </div>
                </div>
                <div class="actions" style="margin-left: 15px;">
                    <button class="btn-remove" title="Remover da Fila"><i class="fas fa-times-circle"></i></button>
                </div>
            `;
            queueList.appendChild(li);
        });

        // Botões de paginação
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
                <li style="justify-content: center; color: #858796; padding: 25px; border-left: none;">
                    Nenhum pedido concluído recentemente nesta sessão.
                </li>
            `;
        } else {
            historyDocs.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div style="width: 100%;">
                        <div style="font-weight: 700; font-size: 1.05rem; color: var(--heading-color);">
                            ${item.name} <span style="font-weight: 400; font-size: 0.85rem; color: #666; margin-left: 10px;"><i class="fab fa-whatsapp"></i> ${item.whatsapp}</span>
                        </div>
                        <div style="background: #f8f9fc; border-left: 4px solid var(--success); padding: 6px 10px; margin-top: 5px; border-radius: 4px; font-size: 0.9rem;">
                            ✅ <strong>Entregue:</strong> <span style="font-weight: 600; color: #2e384d;">${item.lanche || 'Lanche'} + ${item.bebida || ''}</span>
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
                } else {
                    showToast(`🔔 ${newCount} novo(s) pedido(s) na fila! (Som desligado)`, 'warning', 6000);
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
    // CHAMAR PRÓXIMO (WhatsApp + move para histórico)
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
