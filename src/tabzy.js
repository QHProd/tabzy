function Tabzy(id, options = {}) {
    this.opt = Object.assign(
        {
            panelDisplay: 'block',
        },
        options
    );
    this._container = document.getElementById(id); // lấy ra thẻ ul
    if (!this._container) {
        throw new Error(`Tabzy Error: Element with id "${id}" not found.`);
    }

    this._tabs = this._container.querySelectorAll('li'); // lấy ra các thẻ li con của ul
    if (this._tabs.length === 0) {
        throw new Error(`Tabzy: no <li> children found inside #${id}.`);
    }

    // Xử lý click vào thẻ li
    this._boundHandleClick = this._handleClick.bind(this);
    this._container.addEventListener('click', this._boundHandleClick);

    this._init();
}

Tabzy.prototype._init = function () {
    // Lần đầu mở trang web, mặc định chọn thẻ li đầu tiên làm currentTab
    this._currentTab = this._tabs[0];

    this._currentHash = window.location.hash;

    // classList: mặc định luôn có 'tabzy--active', cộng thêm các class caller truyền vào nếu có
    this._classNames = ('tabzy--active ' + (this.opt.cssClass ?? '')).trim();

    this._addClassName();
    this._activeHandler();
};

// Hàm gán class cho currentTab
Tabzy.prototype._addClassName = function () {
    this._classNames.split(' ').forEach((className) => {
        this._currentTab.classList.add(className);
    });
};

// Hàm gỡ class cho currentTab
Tabzy.prototype._removeClassName = function () {
    this._classNames.split(' ').forEach((className) => {
        this._currentTab.classList.remove(className);
    });
};

// Hàm xử lý trạng thái active: nếu li không có class 'tabzy--active' thì content tương ứng sẽ bị ẩn
Tabzy.prototype._activeHandler = function () {
    this._tabs.forEach((tab) => {
        const panel = this._getPanel(tab);
        if (!panel) return;

        if (tab.classList.contains('tabzy--active')) {
            panel.style.display = this.opt.panelDisplay;
        } else {
            panel.style.display = 'none';
        }
    });
};

// Hàm lấy panel tương ứng với thẻ li tab
Tabzy.prototype._getPanel = function (tab) {
    const tabLink = tab.querySelector('a[href]');
    if (!tabLink) return;

    const panelId = tabLink.getAttribute('href');
    const panel = document.querySelector(panelId);

    return panel;
};

// Hàm switch
Tabzy.prototype.switch = function (id) {
    const tabLink = this._container.querySelector(`[href='${id}']`);
    if (!tabLink) return;

    const targetTab = tabLink.closest('li');

    if (!targetTab || targetTab === this._currentTab) return;
    // Gỡ class mặc định khỏi currentTab
    this._removeClassName();
    // Gán lại currentTab
    this._currentTab = targetTab;
    // Gán lại class
    this._addClassName();
    // Gọi lại hàm xử lý trạng thái active
    this._activeHandler();
};

// Hàm destroy
Tabzy.prototype.destroy = function () {
    this._removeClassName();

    this._tabs.forEach((tab) => {
        const panel = this._getPanel(tab);
        if (panel) {
            panel.style.cssText = '';
        }
    });

    this._container.removeEventListener('click', this._boundHandleClick);

    // Xóa các tham chiếu
    this._currentTab = null;
    this._tabs = null;
    this._container = null;
};

Tabzy.prototype._handleClick = function (e) {
    const tabLink = e.target.closest('a[href]');
    if (tabLink) {
        e.preventDefault();
        const currentTabId = tabLink.getAttribute('href');
        this.switch(currentTabId);

        window.location.hash = tabLink.getAttribute('href').slice(1);
    }
};
