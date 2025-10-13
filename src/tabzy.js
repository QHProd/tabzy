function Tabzy(id, options = {}) {
    this.opt = Object.assign(
        {
            contentDisplay: 'block',
        },
        options
    );
    const tabId = document.getElementById(id); // lấy ra thẻ ul
    if (!tabId) {
        throw new Error(`Tabzy Error: Element with id "${id}" not found.`);
    }

    const tabChilds = tabId.querySelectorAll('li'); // lấy ra các thẻ li con của ul
    if (tabChilds.length === 0) {
        throw new Error(`Tabzy: no <li> children found inside #${id}.`);
    }

    // Lần đầu mở trang web, mặc định chọn thẻ li đầu tiên làm currentTab
    this._currentTab = tabChilds[0];

    // classList: mặc định luôn có 'tabzy--active', cộng thêm các class caller truyền vào nếu có
    const classNames = ('tabzy--active ' + (this.opt.cssClass ?? '')).trim();

    // Hàm gán class cho currentTab
    this._addClassName = () => {
        classNames.split(' ').forEach((className) => {
            this._currentTab.classList.add(className);
        });
    };

    // Hàm gỡ class cho currentTab
    this._removeClassName = () => {
        classNames.split(' ').forEach((className) => {
            this._currentTab.classList.remove(className);
        });
    };

    // Hàm xử lý trạng thái active: nếu li không có class 'tabzy--active' thì content tương ứng sẽ bị ẩn
    this._activeHandler = () => {
        tabChilds.forEach((child) => {
            const tabContent = this._getTabContent(child);
            if (!tabContent) return;

            if (child.classList.contains('tabzy--active')) {
                tabContent.style.display = this.opt.contentDisplay;
            } else {
                tabContent.style.display = 'none';
            }
        });
    };

    // Hàm lấy tabContent tương ứng với thẻ li tabChild
    this._getTabContent = (tabChild) => {
        const tabLink = tabChild.querySelector('a[href]');
        if (!tabLink) return;

        const tabContentId = tabLink.getAttribute('href');
        const tabContent = document.querySelector(tabContentId);

        return tabContent;
    };

    // Hàm toggle
    this.toggle = (id) => {
        const tabLink = tabId.querySelector(`[href='${id}']`);
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
    this.destroy = () => {
        this._removeClassName();

        tabChilds.forEach((child) => {
            const tabContent = this._getTabContent(child);
            if (!tabContent) return;
            tabContent.style.cssText = '';
        });

        tabId.removeEventListener('click', this._handleClick);

        this._currentTab = null;
    };

    this._handleClick = (e) => {
        const tabLink = e.target.closest('a[href]');
        if (tabLink) {
            e.preventDefault();
            const currentTabId = tabLink.getAttribute('href');
            this.toggle(currentTabId);
        }
    };

    // Xử lý click vào thẻ li
    tabId.addEventListener('click', this._handleClick);

    this._addClassName();
    this._activeHandler();
}
