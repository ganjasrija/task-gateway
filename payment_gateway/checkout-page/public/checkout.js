(function () {
  class PaymentGateway {
    constructor(options) {
      if (!options || !options.key || !options.orderId) {
        throw new Error("key and orderId are required");
      }

      this.key = options.key;
      this.orderId = options.orderId;
      this.onSuccess = options.onSuccess || function () {};
      this.onFailure = options.onFailure || function () {};
      this.onClose = options.onClose || function () {};

      this.modalId = "payment-gateway-modal";
      this.messageHandler = this.handleMessage.bind(this);

      // Checkout service origin (important for security)
      this.checkoutOrigin = "http://localhost:3001";
    }

    open() {
      if (document.getElementById(this.modalId)) return;

      const modal = document.createElement("div");
      modal.id = this.modalId;
      modal.setAttribute("data-test-id", "payment-modal");

      const iframeSrc =
        `${this.checkoutOrigin}/checkout?order_id=${encodeURIComponent(this.orderId)}` +
        `&key=${encodeURIComponent(this.key)}` +
        `&embedded=true`;

      modal.innerHTML = `
        <div class="modal-overlay" style="
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          padding: 16px;
          box-sizing: border-box;
        ">
          <div class="modal-content" style="
            width: 100%;
            max-width: 420px;
            height: 100%;
            max-height: 600px;
            background: #fff;
            border-radius: 12px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          ">
            <button data-test-id="close-modal-button" style="
              position: absolute;
              top: 10px;
              right: 10px;
              z-index: 10;
              background: #fff;
              border: 1px solid #ccc;
              border-radius: 8px;
              padding: 6px 10px;
              cursor: pointer;
              font-size: 18px;
              line-height: 1;
            ">×</button>

            <iframe
              data-test-id="payment-iframe"
              src="${iframeSrc}"
              style="width:100%;height:100%;border:none;"
            ></iframe>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const closeBtn = modal.querySelector('[data-test-id="close-modal-button"]');
      closeBtn.addEventListener("click", () => this.close());

      window.addEventListener("message", this.messageHandler);
    }

    handleMessage(event) {
      if (!event || !event.data) return;

      // Security: only accept messages from checkout page origin
      if (event.origin !== this.checkoutOrigin) return;

      const { type, data } = event.data;

      if (type === "payment_success") {
        this.onSuccess(data);
        this.close();
        return;
      }

      if (type === "payment_failed") {
        this.onFailure(data);
        return;
      }

      if (type === "close_modal") {
        this.close();
      }
    }

    close() {
      const modal = document.getElementById(this.modalId);
      if (modal) modal.remove();

      window.removeEventListener("message", this.messageHandler);
      this.onClose();
    }
  }

  window.PaymentGateway = PaymentGateway;
})();
