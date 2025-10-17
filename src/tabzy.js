function Tabzy(selector, options = {}) {
    this.opt = Object.assign(
        {
            cssClass: null,
            border: null,
            panelDisplay: 'block',
            remember: false,
            onChange: null,
            restoreHTMLOnDestroy: false,
        },
        options
    );

    this._container = document.querySelector(selector); // lấy ra thẻ ul
    if (!this._container) {
        throw new Error(`Tabzy Error: Element with selector "${selector}" not found.`);
    }

    this._tabs = Array.from(this._container.querySelectorAll('li a[href]')); // từ thẻ ul lấy ra các thẻ a có href và là con của li
    if (this._tabs.length === 0) {
        throw new Error(`Tabzy: no <li> children found inside #${selector}.`);
    }

    const panels = this._tabs
        .map((tab) => {
            return this._getPanel(tab);
        })
        .filter(Boolean);

    if (this._tabs.length !== panels.length) {
        throw new Error(
            `Tabzy Error: Mismatch between tabs and panels. Found ${panels.length} panels for ${this._tabs.length} tabs. ` +
                `Ensure every <li> has an <a href="#panelId"> that matches an existing panel element (id="panelId").`
        );
    }

    // Validate panelDisplay
    const { panelDisplay } = this.opt;
    const validDisplays = [
        'block',
        'flex',
        'grid',
        'inline',
        'inline-block',
        'inline-flex',
        'inline-grid',
        'table',
        'none',
    ];

    if (!validDisplays.includes(panelDisplay)) {
        console.warn(`Tabzy: Invalid panelDisplay "${panelDisplay}". Using "block".`);
        this.opt.panelDisplay = 'block';
    }

    // Validate border config
    const { border } = this.opt;
    if (border) {
        // 1. Kiểm tra các thuộc tính BẮT BUỘC, sau này có thể thêm thuộc tính bắt buộc vào mảng required
        const required = ['position'];
        const missing = required.filter((prop) => !border[prop]);

        if (missing.length > 0) {
            throw new Error(`Tabzy Error: Missing required border options: ${missing.join(', ')}`);
        }

        // 2. Validate giá trị của 'position'
        const validPositions = ['top', 'right', 'bottom', 'left'];
        if (!validPositions.includes(border.position)) {
            throw new Error(
                `Tabzy Error: Invalid border position "${
                    border.position
                }". Must be one of: ${validPositions.join(', ')}`
            );
        }

        // 3. Xử lý các thuộc tính TÙY CHỌN (warn và gán mặc định)
        const defaults = {
            thickness: '2px',
            background: 'green',
            animationTime: '0.3s',
            easing: 'ease',
        };

        for (const opt in defaults) {
            if (!border[opt]) {
                console.warn(
                    `Tabzy Warning: 'border.${opt}' is not defined. Defaulting to '${defaults[opt]}'.`
                );
                // Gán giá trị mặc định trực tiếp vào object
                border[opt] = defaults[opt];
            }
        }
    }

    if (this.opt.remember) {
        this.searchParamKey = this._sanitizeSelector(selector);
    }

    this._init();
}

Tabzy.prototype._init = function () {
    // Lần đầu mở trang web, mặc định chọn thẻ li đầu tiên làm currentTab. Nếu có query params, lấy query params làm currentTab
    let startTab = this._tabs[0].closest('li');

    if (this.opt.remember) {
        const searchParams = new URLSearchParams(location.search);

        const searchParamValue = searchParams.get(this.searchParamKey);

        if (searchParamValue) {
            const currTab = this._tabs.find((tab) => {
                const tabHref = this._sanitizeSelector(tab.getAttribute('href'));
                return tabHref === searchParamValue;
            });

            if (currTab) {
                startTab = currTab.closest('li');
            }
        }
    }

    this._currentTab = startTab;

    // classList: mặc định luôn có 'tabzy--active', cộng thêm các class caller truyền vào nếu có
    this._classNames = ('tabzy--active ' + (this.opt.cssClass ?? '')).trim();
    this._classNamesArray = this._classNames.split(' '); // Cache 1 lần

    // Xử lý click vào thẻ li
    this._boundHandleClick = this._handleClick.bind(this);
    this._container.addEventListener('click', this._boundHandleClick);

    if (this.opt.restoreHTMLOnDestroy) {
        this._originalHTML = this._container.innerHTML;
    }

    this._hasBorder = this.opt.border && Object.keys(this.opt.border).length;

    this._addClassName();
    // Ổn định layout trước
    this._renderState();
    // Sau đó mới tính toán border
    if (this._hasBorder) {
        this._initBorder();

        this._boundHandleResize = this._handleResize.bind(this);
        window.addEventListener('resize', this._boundHandleResize);
    }
};

// Hàm gán class cho currentTab
Tabzy.prototype._addClassName = function () {
    this._classNamesArray.forEach((className) => {
        this._currentTab.classList.add(className);
    });
};

// Hàm gỡ class cho currentTab
Tabzy.prototype._removeClassName = function () {
    if (!this._currentTab || !this._classNamesArray) return; // đề phòng lỗi khi gọi trong destroy()
    this._classNamesArray.forEach((className) => {
        this._currentTab.classList.remove(className);
    });
};

Tabzy.prototype._initBorder = function () {
    const { wrapperSelector, position, thickness, background, animationTime, easing } =
        this.opt.border;

    this.wrapper = document.querySelector(wrapperSelector);

    if (!this.wrapper) {
        throw new Error(
            `Tabzy Border Error: Wrapper element not found for selector "${wrapperSelector}".\n\n` +
                `To use the animated border feature, your tab list (<ul>) must be enclosed within a wrapper element (typically a <div>). Please ensure this wrapper exists in your HTML.\n\n` +
                `Example HTML Structure:\n` +
                `\n` +
                `<div id="my-tabs-wrapper">\n` +
                `  <ul id="my-tabs">...</ul>\n` +
                `</div>\n\n` +
                `Alternatively, for a simple static border, you can remove the 'border' option and apply your styles directly to the '.tabzy--active' class in your CSS.`
        );
    }

    this._inlinePosition = this.wrapper.style.position;

    const computed = getComputedStyle(this.wrapper);

    // Chỉ thêm position nếu chưa có, tránh ghi đè nếu user đã css position.
    if (computed.position === 'static') {
        this.wrapper.style.position = 'relative';
    }

    // Taọ borderElement nếu chưa có
    if (this._borderElement) return;

    this._borderElement = document.createElement('div');
    this.wrapper.appendChild(this._borderElement);

    // Styling
    const isHorizontal = position === 'bottom' || position === 'top';

    // Lấy tọa độ của wrapper và tab đầu tiên
    const wrapperRect = this.wrapper.getBoundingClientRect();
    const initialTabRect = this._currentTab.getBoundingClientRect();

    // Tính toán vị trí tương đối chính xác
    const initialTransform = isHorizontal
        ? `translateX(${initialTabRect.left - wrapperRect.left}px)`
        : `translateY(${initialTabRect.top - wrapperRect.top}px)`;

    const axisProp = isHorizontal ? 'left' : 'top';

    this.borderTransition = isHorizontal
        ? `transform ${animationTime} ${easing}, width ${animationTime} ${easing}`
        : `transform ${animationTime} ${easing}, height ${animationTime} ${easing}`;

    Object.assign(this._borderElement.style, {
        position: 'absolute',
        background,
        transition: 'none', // Đảm bảo refresh trang sẽ không có hiệu ứng trượt từ offset 0 đến offset hiện tại
        [axisProp]: 0,
        [position]: 0,
        // Đặt transform và kích thước ngay từ đầu => không cần gọi _updateBorder trong _init nữa, chỉ gọi _updateBorder khi switch hoặc resize
        transform: initialTransform,
        width: isHorizontal ? `${initialTabRect.width}px` : thickness,
        height: !isHorizontal ? `${initialTabRect.height}px` : thickness,
    });

    // Gán lại transition
    setTimeout(() => {
        this._borderElement.style.transition = this.borderTransition;
    }, 50);
};

Tabzy.prototype._updateBorder = function () {
    const { position } = this.opt.border;
    const wrapperRect = this.wrapper.getBoundingClientRect();
    const tabRect = this._currentTab.getBoundingClientRect();

    if (position === 'bottom' || position === 'top') {
        Object.assign(this._borderElement.style, {
            transform: `translateX(${tabRect.left - wrapperRect.left}px)`,
            width: `${tabRect.width}px`,
        });
    } else if (position === 'left' || position === 'right') {
        Object.assign(this._borderElement.style, {
            transform: `translateY(${tabRect.top - wrapperRect.top}px)`,
            height: `${tabRect.height}px`,
        });
    }
};

Tabzy.prototype._handleResize = function () {
    // 🚦 Kiểm tra: Đã lên lịch cho rAF callback chưa?
    if (this._resizeTicking) return; // ← Lần đầu chạy chưa có → Pass ✅. Nếu đã schedule → SKIP!

    // 🚦 Đánh dấu: "Đang có rAF pending"
    this._resizeTicking = true; // ← Đóng cửa 🔒 Lần đầu chạy sẽ đánh dấu là "đã tiếp nhận và đã lên lịch cho callback này"
    // Nó nói rằng: "Tôi đã lên lịch một công việc cập nhật giao diện rồi, đừng lên lịch thêm nữa cho đến khi công việc đó được hoàn thành."

    // ✅ t=16ms: Browser vẽ frame mới
    requestAnimationFrame(() => {
        this._borderElement.style.transition = 'unset';

        this._updateBorder(); // ✅ Update 1 lần duy nhất

        // 🚦 Reset flag: "rAF đã xong, có thể schedule cho lần tiếp theo"
        this._resizeTicking = false; // ← Mở cửa 🔓 sẵn sàng cho event tiếp theo

        // Debounce để restore transition
        clearTimeout(this._restoreTransitionTimeout);
        // 1. Khi sự kiện resize xảy ra lần đầu tiên, đặt một bộ đếm để restore transition sau 100ms.
        // 2. Nếu sự kiện resize lại xảy ra trước khi 100ms kết thúc, nó sẽ xoá bộ đếm thời gian cũ bằng clearTimeout, sau đó đặt lại bộ đếm mới.
        // 3. Transition sẽ chỉ thực sự được restore khi user ngừng resize và bộ đếm chạy hết 100ms.
        this._restoreTransitionTimeout = setTimeout(() => {
            this._borderElement.style.transition = this.borderTransition;
        }, 100);
    });
};

Tabzy.prototype._renderState = function () {
    this._tabs.forEach((tab) => {
        const panel = this._getPanel(tab);
        if (!panel) return;

        if (tab.closest('li').classList.contains('tabzy--active')) {
            panel.style.display = this.opt.panelDisplay;
        } else {
            panel.style.display = 'none';
        }
    });
};

// Hàm lấy panel tương ứng với thẻ li tab
Tabzy.prototype._getPanel = function (tab) {
    const panelId = tab.getAttribute('href');

    if (!panelId || !panelId.startsWith('#')) {
        console.warn(`Tabzy: Invalid href "${panelId}". Must be a hash selector.`);
        return null;
    }

    return document.querySelector(panelId);
};

// Hàm switch
Tabzy.prototype.switch = function (input) {
    let tab;

    // Nếu input truyền vào là string
    if (typeof input === 'string') {
        tab = this._tabs.find(
            (tab) => tab.getAttribute('href') === input || tab.getAttribute('href') === '#' + input
        );

        if (!tab) {
            console.error(`Tabzy: Tab with href "${input}" not found.`);
            return;
        }
    }
    // Nếu input truyền vào là tab element
    else if (this._tabs.includes(input)) {
        tab = input;
    } else {
        console.error('Tabzy: Invalid input for switch(). Expected string or tab element.');
        return;
    }

    const targetTab = tab.closest('li');

    if (!targetTab) {
        console.error(`Tabzy: No <li> parent found for tab`);
        return;
    }

    if (targetTab === this._currentTab) return;

    // Gỡ class mặc định khỏi currentTab
    this._removeClassName();
    // Gán lại currentTab
    this._currentTab = targetTab;
    // Gán lại class
    this._addClassName();
    // Gọi lại hàm xử lý trạng thái active
    this._renderState();

    if (this._hasBorder) {
        // Đồng bộ với paint của trình duyệt, border position chính xác, smooth animation: best practice cho UI animations.
        requestAnimationFrame(() => {
            this._updateBorder();
        });
    }

    // Xử lý ghi nhớ tab bằng query params
    if (this.opt.remember) {
        const tabHref = this._sanitizeSelector(tab.getAttribute('href'));

        const searchParams = new URLSearchParams(location.search);

        searchParams.set(this.searchParamKey, tabHref);

        history.replaceState(null, '', '?' + searchParams.toString());
    }

    // Hàm xử lý khi thay đổi tab
    if (typeof this.opt.onChange === 'function') {
        this.opt.onChange({
            tab,
            panel: this._getPanel(tab),
        });
    }
};

// Hàm destroy
Tabzy.prototype.destroy = function () {
    if (this._destroyed) return;
    this._destroyed = true;

    // Reset styles
    this._removeClassName();
    this._tabs.forEach((tab) => {
        const panel = this._getPanel(tab);
        if (panel) {
            panel.style.display = '';
        }
    });

    if (this.wrapper) {
        if (this._inlinePosition === '') {
            this.wrapper.style.removeProperty('position');
        } else {
            this.wrapper.style.position = this._inlinePosition;
        }
    }
    // Cleanup event listeners
    this._container.removeEventListener('click', this._boundHandleClick);
    if (this._boundHandleResize) {
        window.removeEventListener('resize', this._boundHandleResize);
    }

    // Cleanup timeout
    if (this._restoreTransitionTimeout) {
        clearTimeout(this._restoreTransitionTimeout);
        this._restoreTransitionTimeout = null;
    }

    // Reset HTML
    if (this.opt.restoreHTMLOnDestroy && this._originalHTML) {
        this._container.innerHTML = this._originalHTML;
        this._originalHTML = null;
    }

    // Clear references
    this.wrapper = null;
    this._currentTab = null;
    this._tabs = null;
    this._container = null;
    this._classNamesArray = null;
    this._boundHandleClick = null;
    this._boundHandleResize = null;

    // Cleanup border
    if (this._borderElement) {
        this._borderElement.remove();
        this._borderElement = null;
    }
};

Tabzy.prototype._handleClick = function (e) {
    const tab = e.target.closest('a[href]');

    if (tab && this._tabs.includes(tab)) {
        e.preventDefault();

        const panelId = tab.getAttribute('href');
        this.switch(panelId);
    }
};

// Hàm loại bỏ ký tự đặc biệt
Tabzy.prototype._sanitizeSelector = function (input) {
    if (typeof input !== 'string') {
        throw new TypeError(`Expected a string but received ${typeof input}.`);
    }

    return input
        .toLowerCase()
        .replace(/\s+/g, '-') // chuyển đổi khoảng trắng (space, tab) thành gạch ngang
        .replace(/[^A-Za-z0-9\-_]/g, '') // loại bỏ tất cả ký tự không phải là [chữ cái, số, gạch ngang, gạch dưới]
        .replace(/-+/g, '-') // nếu có nhiều gạch ngang liên tiếp thì chỉ giữ lại một
        .replace(/^-|-$/g, ''); // loại bỏ gạch ngang ở đầu và cuối nếu có
};
