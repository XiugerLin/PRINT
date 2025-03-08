// 大圖輸出計算器精簡版
const MIN_PRICE = 200, DISCOUNT_TAI = 100, MIN_GROUPS = 1;
const A5_AREA = 14.8 * 21; // A5尺寸面積 cm²
const SMALL_CUT_FEE = 20; // 裁小模額外費用 (元/才)
const $ = id => document.getElementById(id);
const $$ = (s, p = document) => p.querySelector(s);
const $$$ = (s, p = document) => p.querySelectorAll(s);

// 計算App
const app = {
  mats: [], mat: null, groups: [], eventRemover: [],

  // 初始化
  async init() {
    try {
      this.showLoading(true);
      await this.loadMats();
      this.addGroup();
      this.setupEvents();
      this.renderTable();
      this.createBottomButtons();
      this.showLoading(false);
      return true;
    } catch (e) {
      console.error('初始化錯誤:', e);
      this.showLoading(false);
      alert('系統初始化錯誤，請重新整理頁面');
      return false;
    }
  },

  // 顯示/隱藏載入動畫
  showLoading(show) {
    const loader = $('loadingIndicator');
    if (loader) loader.classList[show ? 'add' : 'remove']('active');
  },
  
  // 載入材質資料
  async loadMats() {
    try {
      const res = await fetch('materials.json');
      if (!res.ok) throw new Error(`無法載入材質資料: ${res.status}`);
      this.mats = await res.json();
      return this.mats;
    } catch (error) {
      console.error('材質資料載入失敗:', error);
      throw error;
    }
  },
  
  // 過濾材質
  filterMats(term = '') {
    term = term.toLowerCase().trim();
    return term ? this.mats.filter(m => m.name.toLowerCase().includes(term)) : this.mats;
  },
  
  // 檢查面積是否小於 A5
  isSmallerThanA5(width, height) {
    const area = width * height;
    return area < A5_AREA;
  },
  
  // 檢查是否有任何項目面積小於 A5
  hasSmallCutItems() {
    return this.groups.some(g => this.isSmallerThanA5(g.width, g.height));
  },
  
  // 判斷材質是否需要特殊計算
  isSpecialMaterial(group) {
    if (!this.mat) return false;
    const matName = this.mat.name || '';
    
    // 檢查是否為特殊材質或面積小於 A5
    if (group && group.width && group.height) {
      if (this.isSmallerThanA5(group.width, group.height)) {
        return true; // 小於 A5 的尺寸使用輪廓裁切計算
      }
    }
    
    return matName.includes('輪廓裁型') || matName.includes('合成板裁型');
  },
  
  // 選擇材質
  setMat(mat) {
    if (!mat) return null;
    this.mat = mat;
    $('material').value = mat.name;
    this.calcAll();
    return mat;
  },
  
  // 新增尺寸組
  addGroup() {
    const group = {
      id: Date.now() + '-' + Math.floor(Math.random() * 1000000),
      width: 0.1, height: 0.1, quantity: 1, price: 0, amount: 0, tai: 0,
      isSmallCut: false
    };
    this.groups.push(group);
    this.renderTable();
    
    if (this.groups.length > 1) {
      const rows = $$$('tr[data-group-id]');
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const input = lastRow.querySelector('input');
        if (input) setTimeout(() => { input.focus(); input.select(); }, 10);
      }
    }
    return group;
  },
  
  // 移除尺寸組
  removeGroup(id) {
    if (!id || this.groups.length <= MIN_GROUPS) return false;
    const idx = this.groups.findIndex(g => g.id === id);
    if (idx === -1) return false;
    
    const focusIdx = Math.min(idx, this.groups.length - 2);
    this.groups.splice(idx, 1);
    this.renderTable();
    this.calcAll();
    
    const rows = $$$('tr[data-group-id]');
    if (rows.length > 0 && rows[focusIdx]) {
      const input = rows[focusIdx].querySelector('input');
      if (input) setTimeout(() => { input.focus(); input.select(); }, 10);
    }
    return true;
  },
  
  // 更新尺寸組數據
  updateGroup(id, field, val) {
    if (!id || !field) return false;
    const group = this.groups.find(g => g.id === id);
    if (!group) return false;
    
    if (field === 'width' || field === 'height') {
      val = Math.max(0.1, parseFloat(val) || 0.1);
    } else if (field === 'quantity') {
      val = Math.max(1, parseInt(val) || 1);
    }
    
    group[field] = val;
    
    // 檢查是否小於 A5
    if (field === 'width' || field === 'height') {
      group.isSmallCut = this.isSmallerThanA5(group.width, group.height);
    }
    
    this.calcAll();
    return true;
  },
  
  // 計算才數
  calcTai(w, h, q, isSpecial = false) {
    const width = Math.max(0.1, parseFloat(w) || 0.1);
    const height = Math.max(0.1, parseFloat(h) || 0.1);
    const quantity = Math.max(1, parseInt(q) || 1);
    
    if (isSpecial) {
      // 特殊計算方式：ROUNDUP((長X寬X數量)/900)
      return Math.ceil((width * height * quantity) / 900);
    } else {
      // 一般計算方式：ROUNDUP((長X寬)/900) * 數量
      return Math.ceil((width * height) / 900) * quantity;
    }
  },
  
  // 計算總才數
  totalTai() {
    return this.groups.reduce((sum, g) => sum + (g.tai || 0), 0);
  },
  
  // 計算所有數據
  calcAll() {
    if (!this.mat) return;
    
    // 計算才數和價格
    this.groups.forEach(g => {
      // 檢查面積是否小於 A5
      g.isSmallCut = this.isSmallerThanA5(g.width, g.height);
      
      // 判斷是否為特殊材質或小尺寸
      const isSpecial = this.isSpecialMaterial(g);
      
      g.tai = this.calcTai(g.width, g.height, g.quantity, isSpecial);
    });
    
    const total = this.totalTai();
    const useDisc = total >= DISCOUNT_TAI && this.mat.discount_price !== undefined;
    
    this.groups.forEach(g => {
      const baseUnitPrice = useDisc ? this.mat.discount_price : this.mat.price;
      let unitPrice = baseUnitPrice;
      
      // 如果尺寸小於 A5 且數量大於1，加上裁切費
      if (g.isSmallCut && g.quantity > 1) {
        unitPrice += SMALL_CUT_FEE;
      }
      
      const isSpecial = this.isSpecialMaterial(g);
      
      if (isSpecial) {
        // 特殊材質金額計算：才數 x 單價
        g.extraFee = (g.isSmallCut && g.quantity > 1) ? SMALL_CUT_FEE : 0;
        g.basePrice = baseUnitPrice;
        g.price = null; // 不顯示單價
        g.amount = g.tai * unitPrice;
      } else {
        // 一般材質金額計算
        g.extraFee = (g.isSmallCut && g.quantity > 1) ? SMALL_CUT_FEE : 0;
        g.basePrice = baseUnitPrice;
        const unitTai = Math.ceil((g.width * g.height) / 900);
        g.price = unitTai * unitPrice;
        g.amount = g.price * g.quantity;
      }
    });
    
    const subtotal = this.groups.reduce((sum, g) => sum + g.amount, 0);
    const isMin = subtotal < MIN_PRICE;
    const adjSubtotal = isMin ? MIN_PRICE : subtotal;
    const tax = adjSubtotal * 0.05;
    const total$ = adjSubtotal + tax;
    
    this.updatePrice(total, useDisc);
    this.updateResult({
      subtotal: Math.round(adjSubtotal),
      tax: Math.round(tax),
      total: Math.round(total$),
      totalTai: total,
      isMin, useDisc
    });
    
    this.updateTable();
  },
  
  // 更新表格數值
  updateTable() {
    $$$('tr[data-group-id]').forEach(row => {
      const id = row.dataset.groupId;
      const group = this.groups.find(g => g.id === id);
      if (!group) return;
      
      const isSpecial = this.isSpecialMaterial(group);
      
      const cells = row.querySelectorAll('td');
      if (cells.length >= 7) {
        // 更新才數
        const taiCell = cells[4].querySelector('.read-only-value');
        if (taiCell) taiCell.textContent = group.tai;
        
        // 更新單價 (特殊材質不顯示)
        const priceCell = cells[5].querySelector('.read-only-value');
        if (priceCell) {
          if (isSpecial) {
            priceCell.textContent = '-';
            priceCell.parentNode.classList.add('price-hidden');
          } else {
            priceCell.textContent = group.price?.toLocaleString() || '0';
            priceCell.parentNode.classList.remove('price-hidden');
          }
        }
        
        // 更新金額
        const amountCell = cells[6].querySelector('.read-only-value');
        if (amountCell) amountCell.textContent = group.amount?.toLocaleString() || '0';
      }
    });
  },
  
  // 空方法，保留以維持介面兼容性
  updateSpecialMaterialNotice() {
    // 已移除提示文字功能
  },
  
  // 更新價格顯示
  updatePrice(totalTai, useDisc) {
    if (!this.mat) return;
    const price = $('currentPrice');
    const discBadge = $('priceTypeIndicator');
    if (!price) return;
    
    if (useDisc && this.mat.discount_price !== undefined) {
      price.textContent = this.mat.discount_price;
      price.classList.add('discount-active');
      if (discBadge) discBadge.style.display = 'inline-block';
    } else {
      price.textContent = this.mat.price;
      price.classList.remove('discount-active');
      if (discBadge) discBadge.style.display = 'none';
    }
  },
  
  // 更新結果顯示
  updateResult(data) {
    const { subtotal, tax, total, totalTai, isMin, useDisc } = data;
    
    if ($('subtotal')) $('subtotal').textContent = subtotal.toLocaleString();
    if ($('tax')) $('tax').textContent = tax.toLocaleString();
    if ($('totalPrice')) $('totalPrice').textContent = total.toLocaleString();
    if ($('totalTai')) $('totalTai').textContent = totalTai.toLocaleString();
    
    // 顯示提示
    const minNotice = $('minimum-notice');
    const discNotice = $('discount-notice');
    const result = $$('.result');
    
    if (minNotice) minNotice.style.display = isMin ? 'block' : 'none';
    if (result) result.classList[isMin ? 'add' : 'remove']('below-minimum');
    
    if (discNotice) {
      discNotice.style.display = useDisc ? 'block' : 'none';
      if (result) result.classList[useDisc ? 'add' : 'remove']('discount-applied');
    }
  },
  
  // 渲染尺寸表格
  renderTable() {
    const tbody = $$('#dimensionTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    this.groups.forEach((group, i) => {
      const tr = document.createElement('tr');
      tr.dataset.groupId = group.id;
      
      // 檢查面積是否小於 A5
      group.isSmallCut = this.isSmallerThanA5(group.width, group.height);
      
      // 添加序號欄
      tr.appendChild(this.createCell(i + 1));
      
      // 長度欄
      tr.appendChild(this.createInputCell(
        'number', group.width, '0.1', `第${i + 1}組長度`, i * 3 + 1,
        e => this.handleInput(e, group.id, 'width')
      ));
      
      // 寬度欄
      tr.appendChild(this.createInputCell(
        'number', group.height, '0.1', `第${i + 1}組寬度`, i * 3 + 2,
        e => this.handleInput(e, group.id, 'height')
      ));
      
      // 數量欄
      tr.appendChild(this.createInputCell(
        'number', group.quantity, '1', `第${i + 1}組數量`, i * 3 + 3,
        e => this.handleInput(e, group.id, 'quantity', i === this.groups.length - 1)
      ));
      
      // 才數欄
      tr.appendChild(this.createReadOnlyCell(group.tai || '0', `第${i + 1}組才數`));
      
      // 單價欄
      const isSpecial = this.isSpecialMaterial(group);
      const priceCell = this.createReadOnlyCell(
        isSpecial ? '-' : (group.price?.toLocaleString() || '0'), 
        `第${i + 1}組單價`
      );
      
      if (isSpecial) {
        priceCell.classList.add('price-hidden');
      }
      
      tr.appendChild(priceCell);
      
      // 金額欄
      tr.appendChild(this.createReadOnlyCell(group.amount?.toLocaleString() || '0', `第${i + 1}組金額`));
      
      // 刪除按鈕欄
      tr.appendChild(this.createDeleteCell(i, group.id));
      
      tbody.appendChild(tr);
    });
  },
  
  // 處理輸入事件
  handleInput(e, id, field, isLast = false) {
    if (!e || !id || !field) return;
    
    const input = e.target;
    if (!input) return;
    
    if (e.type === 'change' || e.type === 'blur') {
      this.updateGroup(id, field, input.value);
    } else if (e.type === 'keydown') {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        this.updateGroup(id, field, input.value);
        
        if (isLast && field === 'quantity' && e.key === 'Enter') {
          this.addGroup();
        } else {
          this.focusNext(input);
        }
      }
    }
  },
  
  // 聚焦到下一個輸入框
  focusNext(input) {
    if (!input) return;
    
    const inputs = Array.from($$$('#dimensionTable input'));
    const idx = inputs.indexOf(input);
    
    if (idx !== -1 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
      inputs[idx + 1].select();
    }
  },
  
  // 創建基本單元格
  createCell(text) {
    const td = document.createElement('td');
    td.textContent = text;
    return td;
  },
  
  // 創建輸入單元格
  createInputCell(type, value, step, label, tabIndex, handler) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    
    input.type = type;
    input.value = value;
    input.min = step;
    input.step = step;
    input.setAttribute('aria-label', label);
    input.tabIndex = tabIndex;
    input.setAttribute('inputmode', type === 'number' ? 'decimal' : 'text');
    input.classList.add('dimension-input');
    
    input.addEventListener('change', handler);
    input.addEventListener('blur', handler);
    input.addEventListener('keydown', handler);
    
    td.appendChild(input);
    return td;
  },
  
  // 創建只讀單元格
  createReadOnlyCell(value, label) {
    const td = document.createElement('td');
    const span = document.createElement('span');
    
    span.className = 'read-only-value';
    span.setAttribute('aria-label', label);
    span.textContent = value;
    
    td.appendChild(span);
    return td;
  },
  
  // 創建刪除按鈕
  createDeleteCell(index, id) {
    const td = document.createElement('td');
    const btn = document.createElement('button');
    
    btn.textContent = '✕';
    btn.className = 'remove-row-btn';
    btn.setAttribute('aria-label', `刪除第${index + 1}組`);
    btn.title = `刪除第${index + 1}組`;
    
    if (this.groups.length <= MIN_GROUPS) {
      btn.disabled = true;
      btn.classList.add('disabled');
      btn.title = '至少需保留一組尺寸';
    }
    
    btn.addEventListener('click', () => this.removeGroup(id));
    
    td.appendChild(btn);
    return td;
  },
  
  // 更新材質下拉選單
  updateMatDropdown(term) {
    const dropdown = $('materialDropdown');
    if (!dropdown) return;
    
    const filtered = this.filterMats(term);
    dropdown.innerHTML = '';
    
    if (filtered.length === 0) {
      dropdown.appendChild(this.createMatOption('沒有符合的材質'));
    } else {
      filtered.forEach(m => {
        const opt = this.createMatOption(m.name);
        
        opt.addEventListener('click', () => {
          this.setMat(m);
          dropdown.querySelectorAll('.material-option').forEach(o => {
            o.setAttribute('aria-selected', 'false');
          });
          opt.setAttribute('aria-selected', 'true');
          dropdown.classList.remove('show');
          
          const firstInput = $$('#dimensionTable input');
          if (firstInput) {
            firstInput.focus();
            firstInput.select();
          }
        });
        
        dropdown.appendChild(opt);
      });
    }
    
    dropdown.classList.add('show');
  },
  
  // 創建材質選項
  createMatOption(text) {
    const opt = document.createElement('div');
    opt.className = 'material-option';
    opt.textContent = text;
    opt.setAttribute('role', 'option');
    opt.setAttribute('aria-selected', 'false');
    return opt;
  },

  // 全部清除功能
  clearAll() {
    this.mat = null;
    if ($('material')) $('material').value = '';
    
    this.groups = [];
    this.addGroup();
    this.renderTable();
    
    // 清除顯示
    ['subtotal', 'tax', 'totalPrice', 'totalTai'].forEach(id => {
      if ($(id)) $(id).textContent = '0';
    });
    
    // 隱藏提示
    const minNotice = $('minimum-notice');
    const discNotice = $('discount-notice');
    const result = $$('.result');
    
    if (minNotice) minNotice.style.display = 'none';
    if (discNotice) discNotice.style.display = 'none';
    if (result) {
      result.classList.remove('below-minimum');
      result.classList.remove('discount-applied');
    }
    
    // 重置價格顯示
    const price = $('currentPrice');
    const discBadge = $('priceTypeIndicator');
    
    if (price) {
      price.textContent = '0';
      price.classList.remove('discount-active');
    }
    if (discBadge) discBadge.style.display = 'none';
    
    // 聚焦材質框
    const matInput = $('material');
    if (matInput) matInput.focus();
    
    // 移除任何可能存在的提示元素
    const notice = $('.special-calculation-notice');
    if (notice && notice.parentNode) {
      notice.parentNode.removeChild(notice);
    }
  },
  
  // 創建底部按鈕
  createBottomButtons() {
    const btnContainer = document.createElement('div');
    btnContainer.className = 'bottom-buttons';
    
    // 清除按鈕
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clearAll';
    clearBtn.className = 'clear-all-btn bottom-btn';
    clearBtn.textContent = '全部清除';
    clearBtn.setAttribute('aria-label', '清除所有輸入資料');
    clearBtn.addEventListener('click', () => this.clearAll());
    
    // 輸出報表按鈕
    const exportBtn = document.createElement('button');
    exportBtn.id = 'exportReport';
    exportBtn.className = 'export-report-btn bottom-btn';
    exportBtn.textContent = '輸出報表';
    exportBtn.setAttribute('aria-label', '產生並輸出報表');
    exportBtn.addEventListener('click', () => this.showReportModal());
    
    btnContainer.appendChild(clearBtn);
    btnContainer.appendChild(exportBtn);
    
    const disclaimer = $$('.disclaimer');
    if (disclaimer && disclaimer.parentNode) {
      disclaimer.parentNode.insertBefore(btnContainer, disclaimer);
    }
    
    this.setupReportModalEvents();
  },

  // 設置報表視窗事件
  setupReportModalEvents() {
    const modal = $('reportModal');
    const modalContent = modal?.querySelector('.report-modal-content');
    const modalHeader = modal?.querySelector('.report-modal-header');
    const closeBtn = $('closeReportModal');
    const copyBtn = $('copyReport');
    
    if (!modal || !closeBtn || !copyBtn || !modalContent || !modalHeader) return;
    
    this.cleanupModalEvents();
    
    // 關閉按鈕點擊事件
    const closeBtnHandler = () => this.hideReportModal();
    closeBtn.addEventListener('click', closeBtnHandler);
    this.eventRemover.push(() => closeBtn.removeEventListener('click', closeBtnHandler));
    
    // 點擊視窗外部關閉
    const modalClickHandler = (e) => {
      if (e.target === modal) this.hideReportModal();
    };
    modal.addEventListener('click', modalClickHandler);
    this.eventRemover.push(() => modal.removeEventListener('click', modalClickHandler));
    
    // 複製按鈕事件
    const copyBtnHandler = () => this.copyReportContent();
    copyBtn.addEventListener('click', copyBtnHandler);
    this.eventRemover.push(() => copyBtn.removeEventListener('click', copyBtnHandler));
    
    // ESC鍵關閉視窗
    const escKeyHandler = (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        this.hideReportModal();
      }
    };
    document.addEventListener('keydown', escKeyHandler);
    this.eventRemover.push(() => document.removeEventListener('keydown', escKeyHandler));
    
    // 添加拖曳功能
    this.setupDraggableModal(modalContent, modalHeader);
  },

  // 清理報表視窗事件
  cleanupModalEvents() {
    while (this.eventRemover.length) {
      const removeEvent = this.eventRemover.pop();
      if (typeof removeEvent === 'function') {
        try {
          removeEvent();
        } catch (error) {
          console.error('移除事件失敗:', error);
        }
      }
    }
  },

  // 設置可拖曳視窗
  setupDraggableModal(modalContent, modalHeader) {
    if (!modalContent || !modalHeader) return;
    
    let isDragging = false;
    let offsetX, offsetY, startX, startY;
    
    // 滑鼠按下事件
    const onMouseDown = (e) => {
      if (e.target.closest('.close-modal-btn')) return;
      
      isDragging = true;
      modalContent.classList.add('dragging');
      
      const rect = modalContent.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      startX = rect.left;
      startY = rect.top;
      
      e.preventDefault();
    };
    
    // 滑鼠移動事件
    const onMouseMove = (e) => {
      if (!isDragging) return;
      
      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;
      modalContent.style.transform = `translate(${newX - startX}px, ${newY - startY}px)`;
    };
    
    // 滑鼠釋放事件
    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      modalContent.classList.remove('dragging');
    };
    
    // 添加事件監聽
    modalHeader.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    this.eventRemover.push(() => modalHeader.removeEventListener('mousedown', onMouseDown));
    this.eventRemover.push(() => document.removeEventListener('mousemove', onMouseMove));
    this.eventRemover.push(() => document.removeEventListener('mouseup', onMouseUp));
    
    // 觸控事件支援
    const onTouchStart = (e) => {
      const touch = e.touches[0];
      onMouseDown({ 
        clientX: touch.clientX, 
        clientY: touch.clientY,
        preventDefault: () => e.preventDefault(),
        target: e.target
      });
    };
    
    const onTouchMove = (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    };
    
    modalHeader.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onMouseUp);
    
    this.eventRemover.push(() => modalHeader.removeEventListener('touchstart', onTouchStart));
    this.eventRemover.push(() => document.removeEventListener('touchmove', onTouchMove));
    this.eventRemover.push(() => document.removeEventListener('touchend', onMouseUp));
  },

  // 顯示報表視窗
  showReportModal() {
    // 檢查是否選擇了材質
    if (!this.mat) {
      alert('請先選擇材質');
      return;
    }
    
    // 檢查是否有有效尺寸組
    const validGroups = this.groups.filter(g => g.width > 0 && g.height > 0);
    if (validGroups.length === 0) {
      alert('請先輸入有效的尺寸');
      return;
    }
    
    // 設置報表內容
    const reportContent = this.generateReport();
    const reportContentEl = $('reportContent');
    if (reportContentEl) reportContentEl.textContent = reportContent;
    
    // 顯示視窗
    const modal = $('reportModal');
    if (!modal) return;
    
    // 重置視窗位置
    const modalContent = modal.querySelector('.report-modal-content');
    if (modalContent) modalContent.style.transform = '';
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    // 聚焦關閉按鈕
    const closeBtn = $('closeReportModal');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 100);
  },

  // 隱藏報表視窗
  hideReportModal() {
    const modal = $('reportModal');
    if (!modal) return;
    
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    // 重置複製按鈕
    const copyBtn = $('copyReport');
    if (copyBtn) {
      copyBtn.textContent = '複製報表';
      copyBtn.classList.remove('copied', 'error');
    }
  },

  // 生成報表
  generateReport() {
    if (!this.mat) return '';
    
    let report = '';
    let validGroupCount = 0;
    
    // 添加尺寸組信息
    this.groups.forEach((group, index) => {
      if (group.width <= 0 || group.height <= 0) return;
      
      validGroupCount++;
      report += `${validGroupCount}\n`;
      report += `材質:${this.mat.name}\n`;
      
      const width = parseFloat(group.width).toFixed(1);
      const height = parseFloat(group.height).toFixed(1);
      report += `尺寸:${width}x${height}cm\n`;
      
      const isSpecial = this.isSpecialMaterial(group);
      
      if (isSpecial) {
        // 特殊材質，不顯示單價
        report += `數量:${group.quantity}片\n`;
      } else if (group.quantity === 1) {
        report += `數量:${group.quantity}片\n`;
      } else {
        report += `數量:${group.quantity}片(單價:$${group.price.toLocaleString()})\n`;
      }
      
      report += `金額:$${Math.round(group.amount).toLocaleString()}\n`;
      
      if (index < this.groups.length - 1 && 
          this.groups.slice(index + 1).some(g => g.width > 0 && g.height > 0)) {
        report += '\n';
      }
    });
    
    if (validGroupCount === 0) return '';
    
    // 計算總金額
    const subtotal = Math.round(this.groups.reduce((sum, g) => sum + g.amount, 0));
    const isMin = subtotal < MIN_PRICE;
    const adjSubtotal = isMin ? MIN_PRICE : subtotal;
    const tax = Math.round(adjSubtotal * 0.05);
    const totalPrice = adjSubtotal + tax;
    
    // 添加總結
    report += '\n-----\n';
    report += `合計:$${adjSubtotal.toLocaleString()}\n`;
    report += `稅金:$${tax.toLocaleString()}\n`;
    report += `總計:$${totalPrice.toLocaleString()}`;
    
    if (isMin) {
      report += '\n\n**大圖輸出基本價$200未稅，未滿基本價以基本價計。**';
    }
    
    return report;
  },

  // 複製報表內容
  copyReportContent() {
    const reportContent = $('reportContent');
    if (!reportContent) return;
    
    const textToCopy = reportContent.textContent;
    if (!textToCopy) return;
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => this.updateCopyButton(true))
        .catch(err => {
          console.error('無法複製到剪貼板:', err);
          this.fallbackCopyTextToClipboard(textToCopy);
        });
    } else {
      this.fallbackCopyTextToClipboard(textToCopy);
    }
  },

  // 複製文本的備用方法
  fallbackCopyTextToClipboard(text) {
    if (!text) return;
    
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    
    document.body.appendChild(textarea);
    
    try {
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      this.updateCopyButton(successful);
    } catch (err) {
      console.error('複製過程中發生錯誤:', err);
      this.updateCopyButton(false);
    } finally {
      document.body.removeChild(textarea);
    }
  },

  // 更新複製按鈕狀態
  updateCopyButton(success) {
    const copyBtn = $('copyReport');
    if (!copyBtn) return;
    
    if (success) {
      copyBtn.textContent = '已複製!';
      copyBtn.classList.add('copied');
      copyBtn.classList.remove('error');
      copyBtn.setAttribute('aria-label', '報表內容已成功複製');
    } else {
      copyBtn.textContent = '複製失敗';
      copyBtn.classList.add('error');
      copyBtn.classList.remove('copied');
      copyBtn.setAttribute('aria-label', '複製失敗，請再試一次');
    }
    
    setTimeout(() => {
      if (copyBtn && document.body.contains(copyBtn)) {
        copyBtn.textContent = '複製報表';
        copyBtn.classList.remove('copied', 'error');
        copyBtn.setAttribute('aria-label', '複製報表內容');
      }
    }, 2000);
  },
  
  // 設置事件監聽
  setupEvents() {
    const matInput = $('material');
    const matDropdown = $('materialDropdown');
    const addBtn = $('addDimension');
    
    if (!matInput || !matDropdown || !addBtn) return;
    
    // 材質輸入事件
    matInput.addEventListener('input', e => this.updateMatDropdown(e.target.value));
    matInput.addEventListener('focus', () => this.updateMatDropdown(matInput.value));
    
    // 鍵盤事件
    matInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && matDropdown.classList.contains('show')) {
        const firstOpt = matDropdown.querySelector('.material-option');
        if (firstOpt) {
          e.preventDefault();
          firstOpt.click();
        }
      } else if (e.key === 'Escape') {
        matDropdown.classList.remove('show');
      } else if (e.key === 'ArrowDown' && matDropdown.classList.contains('show')) {
        e.preventDefault();
        const firstOpt = matDropdown.querySelector('.material-option');
        if (firstOpt) firstOpt.focus();
      }
    });
    
    // 點擊外部關閉下拉
    document.addEventListener('click', e => {
      if (!matInput.contains(e.target) && !matDropdown.contains(e.target)) {
        matDropdown.classList.remove('show');
      }
    });
    
    // 新增尺寸組按鈕
    addBtn.addEventListener('click', () => {
      this.addGroup();
      setTimeout(() => {
        const inputs = $$$('#dimensionTable input');
        const lastInputs = Array.from(inputs).slice(-3);
        if (lastInputs.length > 0) {
          lastInputs[0].focus();
          lastInputs[0].select();
        }
      }, 50);
    });
    
    // 快捷鍵
    document.addEventListener('keydown', e => {
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        addBtn.click();
      }
    });
    
    // 隱藏通知
    [$('minimum-notice'), $('discount-notice'), $('priceTypeIndicator')].forEach(el => {
      if (el) el.style.display = 'none';
    });
  }
};

// QR Code 放大功能
function setupQrCodeEnlarge() {
  const qrCodeWrapper = $('qrCodeWrapper');
  const qrCodeModal = $('qrcodeModal');
  const closeQrcodeModal = $('closeQrcodeModal');
  const qrCodeImage = $('qrCodeImage');
  const enlargedQrcode = $('enlargedQrcode');
  
  if (!qrCodeWrapper || !qrCodeModal || !closeQrcodeModal || !qrCodeImage || !enlargedQrcode) {
    console.error('無法找到QR Code相關元素');
    return;
  }
  
  // 點擊QR Code顯示放大視窗
  qrCodeWrapper.addEventListener('click', function() {
    enlargedQrcode.src = qrCodeImage.src;
    qrCodeModal.classList.add('show');
    qrCodeModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => closeQrcodeModal.focus(), 100);
  });
  
  // 鍵盤支援
  qrCodeWrapper.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      qrCodeWrapper.click();
    }
  });
  
  // 關閉視窗
  closeQrcodeModal.addEventListener('click', function() {
    qrCodeModal.classList.remove('show');
    qrCodeModal.setAttribute('aria-hidden', 'true');
    qrCodeWrapper.focus();
  });
  
  // 點擊外部關閉
  qrCodeModal.addEventListener('click', function(e) {
    if (e.target === qrCodeModal) {
      closeQrcodeModal.click();
    }
  });
  
  // ESC鍵關閉
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && qrCodeModal.classList.contains('show')) {
      closeQrcodeModal.click();
    }
  });
}

// 將QR Code功能添加到初始化
const originalInit = app.init;
app.init = async function() {
  const result = await originalInit.call(this);
  if (result) setupQrCodeEnlarge();
  return result;
};

// 初始化應用
document.addEventListener('DOMContentLoaded', () => app.init());