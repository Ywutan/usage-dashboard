/**
 * Usage-report Remote owner: the per-workspace usage report and raw
 * session-log read, computed from persisted session logs. A read-only,
 * optional capability — composed only when the usage-dashboard bundle is
 * installed, so the base workspace controller stays unmodified.
 */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { buildHourFormatter, WorkspaceUsage } from "./usage.js";
export { WorkspaceUsage, DEEPSEEK_PRICING, rangeOf } from "./usage.js";
/** Host service backing the generated `ctx.remote.usage` namespace. */
let UsageController = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _report_decorators;
    let _sessionLog_decorators;
    return class UsageController extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _report_decorators = [Remote('report')];
            _sessionLog_decorators = [Remote('sessionLog')];
            __esDecorate(this, null, _report_decorators, { kind: "method", name: "report", static: false, private: false, access: { has: obj => "report" in obj, get: obj => obj.report }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _sessionLog_decorators, { kind: "method", name: "sessionLog", static: false, private: false, access: { has: obj => "sessionLog" in obj, get: obj => obj.sessionLog }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['typert', 'workspaceRegistry', 'sessionPersistence', 'sessions'];
        usage = __runInitializers(this, _instanceExtraInitializers);
        /** @param ctx - Host context containing the Workspace registry and session persistence. */
        constructor(ctx) {
            super(ctx, 'usageController', { namespace: 'usage' });
            this.usage = new WorkspaceUsage(ctx);
        }
        /**
         * Compute the usage report for one Workspace over an optional window.
         * @param request - target Workspace, caller-local time zone, and window.
         * @param signal - cancellation for persistence reads.
         * @returns totals, hourly series, per-model and per-session aggregates.
         * @throws RemoteError `gateway/bad-request` for an invalid time zone, or
         *   `usage/workspace-not-found` for an unknown Workspace.
         */
        report(request, signal) {
            try {
                buildHourFormatter(request.timeZone);
            }
            catch {
                return Promise.reject(new RemoteError('gateway/bad-request', `usage report: unknown time zone "${request.timeZone}"`, {}));
            }
            return this.usage.report(request, signal);
        }
        /**
         * Read the raw event log of one Session accounted to a Workspace.
         * @param request - Workspace and Session identities.
         * @param signal - cancellation for persistence reads.
         * @returns the Session's creation instant and its newest event rows.
         * @throws RemoteError `usage/workspace-not-found`,
         *   `usage/session-not-in-workspace`, or `usage/session-log-unavailable`
         *   on the documented conditions.
         */
        sessionLog(request, signal) {
            return this.usage.sessionLog(request, signal);
        }
    };
})();
export { UsageController };
export default UsageController;
//# sourceMappingURL=index.js.map