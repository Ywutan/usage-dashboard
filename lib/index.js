import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { SessionPersistenceNotFoundError } from "@deepseek-ai/dsh-session-persistence";
//#region lib/types/usage.js
/**
* Per-workspace usage report fold over session event logs: attribute each loop
* response to the request header that preceded it and each compaction summary
* to the route it recorded, price tokens with the built-in DeepSeek table
* (peak and off-peak by UTC), and bucket the series by local hour in the
* caller's IANA zone. Stored sessions are read through the handle-based
* persistence seam and live ones from their in-memory log, so both paths fold
* the same validated `SessionEvent` rows. I/O (registry lookup, persistence
* reads) lives in the service; the fold and pricing helpers are pure so the
* report logic is unit-testable.
*
* @module @deepseek-ai/dsh-usage-dashboard/usage
*/
function emptyAccumulator() {
	return {
		apiCalls: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		totalTokens: 0,
		costUsd: 0,
		unpricedCalls: 0
	};
}
/** The official DeepSeek API pricing basis, checked against api-docs.deepseek.com on 2026-08-30. */
const DEEPSEEK_PRICING = {
	"deepseek-v4-flash": {
		cacheHitInputPerM: .007,
		cacheMissInputPerM: .22,
		outputPerM: .66,
		peak: {
			cacheHitInputPerM: .014,
			cacheMissInputPerM: .44,
			outputPerM: 1.32
		}
	},
	"deepseek-v4-pro": {
		cacheHitInputPerM: .022,
		cacheMissInputPerM: .66,
		outputPerM: 1.98,
		peak: {
			cacheHitInputPerM: .044,
			cacheMissInputPerM: 1.32,
			outputPerM: 3.96
		}
	},
	"deepseek-chat": {
		cacheHitInputPerM: .07,
		cacheMissInputPerM: .27,
		outputPerM: 1.1
	},
	"deepseek-reasoner": {
		cacheHitInputPerM: .14,
		cacheMissInputPerM: .55,
		outputPerM: 2.19
	}
};
/**
* Resolve the USD price basis for one model id.
* @param model - model id recorded in a session log.
* @returns the price basis, or `undefined` when the model is not priced.
*/
function modelPrice(model) {
	return DEEPSEEK_PRICING[model];
}
/**
* Whether a UTC instant falls in the DeepSeek peak window (Monday–Friday,
* 01:00–04:00 and 06:00–10:00 UTC; all other hours are off-peak).
* @param epochMs - Unix epoch milliseconds.
* @returns true during the peak window.
*/
function isPeakUtc(epochMs) {
	const date = new Date(epochMs);
	const day = date.getUTCDay();
	if (day === 0 || day === 6) return false;
	const hour = date.getUTCHours();
	return hour >= 1 && hour < 4 || hour >= 6 && hour < 10;
}
/**
* Price one model response. `TokenUsage` counts are disjoint: `inputTokens`
* is uncached input, billed at the cache-miss rate, and `cacheReadTokens` is
* the cache-hit input, billed at the hit rate; output tokens bill at the
* output rate and cache-write tokens are not billed. Peak rates apply inside
* the DeepSeek peak window.
* @param price - the model's price basis.
* @param usage - the response's token accounting.
* @param epochMs - response time, decides the peak window.
* @returns the estimated USD cost.
*/
function priceCall(price, usage, epochMs) {
	const basis = isPeakUtc(epochMs) && price.peak !== void 0 ? price.peak : price;
	const miss = Math.max(0, usage.inputTokens);
	const hit = Math.max(0, usage.cacheReadTokens ?? 0);
	const output = Math.max(0, usage.outputTokens);
	return (miss * basis.cacheMissInputPerM + hit * basis.cacheHitInputPerM + output * basis.outputPerM) / 1e6;
}
/**
* Wall-clock hour parts of one instant in a zone.
* @param formatter - one reusable formatter built by {@link buildHourFormatter}.
* @param epochMs - instant to bucket.
* @returns the local hour key and the Unix epoch milliseconds at that hour's start.
*/
function hourBucketOf(formatter, epochMs) {
	const parts = formatter.formatToParts(epochMs);
	const field = (type) => {
		const part = parts.find((entry) => entry.type === type);
		if (part === void 0) throw new Error(`hour formatter has no "${type}" part`);
		return Number(part.value);
	};
	const year = field("year");
	const month = field("month");
	const day = field("day");
	const hour = field("hour");
	const key = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`;
	const offset = Date.UTC(year, month - 1, day, hour, field("minute"), field("second")) - epochMs;
	return {
		key,
		start: epochMs + offset - (epochMs + offset) % 36e5 - offset
	};
}
/**
* Build one reusable local-hour formatter for a zone.
* @param timeZone - IANA time-zone name.
* @returns a formatter yielding year/month/day/hour/minute/second parts in that zone.
*/
function buildHourFormatter(timeZone) {
	return new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23"
	});
}
/** Whether an event instant falls inside a report window. */
function inRange(time, range) {
	return range === void 0 || time >= range.start && time < range.end;
}
/** Fold event rows into model responses and counters. */
function foldEventRows(rows, range) {
	const calls = [];
	let toolCalls = 0;
	let turns = 0;
	let firstEventAt = 0;
	let lastEventAt = 0;
	let provider;
	let model;
	for (const event of rows) {
		if (!inRange(event.time, range)) continue;
		if (firstEventAt === 0 || event.time < firstEventAt) firstEventAt = event.time;
		if (event.time > lastEventAt) lastEventAt = event.time;
		const data = event.data;
		switch (event.type) {
			case "request/header": {
				const headerConfig = (data?.header)?.config;
				if (typeof headerConfig?.provider === "string") provider = headerConfig.provider;
				if (typeof headerConfig?.model === "string") model = headerConfig.model;
				break;
			}
			case "assistant/message": {
				const usage = data?.usage;
				calls.push({
					time: event.time,
					provider: provider ?? "unknown",
					model: model ?? "unknown",
					...isTokenUsage(usage) ? { usage } : {}
				});
				break;
			}
			case "compaction/summary": {
				const usage = data?.usage;
				const accounted = isTokenUsage(usage);
				if (!accounted && data?.llmStreamCall !== true) break;
				calls.push({
					time: event.time,
					provider: typeof data?.provider === "string" ? data.provider : "unknown",
					model: typeof data?.model === "string" ? data.model : "unknown",
					...accounted ? { usage } : {}
				});
				break;
			}
			case "tool/call":
				toolCalls += 1;
				break;
			case "turn/start": turns += 1;
		}
	}
	return {
		calls,
		toolCalls,
		turns,
		firstEventAt,
		lastEventAt
	};
}
/**
* Fold one session's canonical events into model responses and counters.
* Stored logs arrive from the persistence handle seam and live ones from the
* running session's in-memory log; both are already validated `SessionEvent`
* rows, so the fold is the only step either path needs.
* @param meta - the session's storage header.
* @param events - the session's canonical events, in log order.
* @param range - optional window restricting which events are folded.
* @returns the log fold.
*/
function foldSessionLog(meta, events, range) {
	return {
		meta,
		...foldEventRows(events, range)
	};
}
/** Structural guard over adapter-reported token accounting. */
function isTokenUsage(value) {
	return typeof value === "object" && value !== null && typeof value.inputTokens === "number" && typeof value.outputTokens === "number";
}
/** Fold one call into an accumulator. */
function accumulate(acc, call) {
	acc.apiCalls += 1;
	const usage = call.usage;
	if (usage === void 0) return;
	acc.inputTokens += usage.inputTokens;
	acc.outputTokens += usage.outputTokens;
	acc.cacheReadTokens += usage.cacheReadTokens ?? 0;
	acc.cacheWriteTokens += usage.cacheWriteTokens ?? 0;
	acc.totalTokens += usage.totalTokens ?? usage.inputTokens + usage.outputTokens;
	const price = modelPrice(call.model);
	if (price === void 0) {
		acc.unpricedCalls += 1;
		return;
	}
	acc.costUsd += priceCall(price, usage, call.time);
}
/** The per-call cost delta and pricing status for one model response. */
function contribution(call) {
	if (call.usage === void 0) return {
		costUsd: 0,
		unpriced: false
	};
	const price = modelPrice(call.model);
	if (price === void 0) return {
		costUsd: 0,
		unpriced: true
	};
	return {
		costUsd: priceCall(price, call.usage, call.time),
		unpriced: false
	};
}
/** Token totals contributed by one model response. */
function tokensOf(call) {
	const usage = call.usage;
	if (usage === void 0) return {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		totalTokens: 0
	};
	return {
		inputTokens: usage.inputTokens,
		outputTokens: usage.outputTokens,
		cacheReadTokens: usage.cacheReadTokens ?? 0,
		cacheWriteTokens: usage.cacheWriteTokens ?? 0,
		totalTokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens
	};
}
/**
* The optional inclusive/exclusive window a request asks for.
* @param request - the report request carrying the optional bounds.
* @returns the window, or undefined when the request set neither bound.
*/
function rangeOf(request) {
	return request.rangeStart !== void 0 || request.rangeEnd !== void 0 ? {
		start: request.rangeStart ?? Number.NEGATIVE_INFINITY,
		end: request.rangeEnd ?? Number.POSITIVE_INFINITY
	} : void 0;
}
/**
* Fold folded session logs into the complete report value.
* @param request - the originating request, for the echoed window and zone.
* @param path - canonical Workspace directory path.
* @param title - Workspace display title.
* @param generatedAt - Unix epoch milliseconds stamped on the report.
* @param logs - one fold per accounted Session.
* @returns totals, the hourly series, and the per-model and per-session aggregates.
*/
function buildUsageReport(request, path, title, generatedAt, logs) {
	const range = rangeOf(request);
	const totals = {
		sessions: 0,
		apiCalls: 0,
		toolCalls: 0,
		turns: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		totalTokens: 0,
		costUsd: 0,
		unpricedCalls: 0,
		firstEventAt: 0,
		lastEventAt: 0
	};
	const byModel = /* @__PURE__ */ new Map();
	const bySession = /* @__PURE__ */ new Map();
	const byHour = /* @__PURE__ */ new Map();
	const unknownModels = /* @__PURE__ */ new Set();
	const formatter = buildHourFormatter(request.timeZone);
	for (const log of logs) {
		const sessionAcc = emptyAccumulator();
		if (totals.firstEventAt === 0 || log.firstEventAt < totals.firstEventAt) totals.firstEventAt = log.firstEventAt;
		if (log.lastEventAt > totals.lastEventAt) totals.lastEventAt = log.lastEventAt;
		for (const call of log.calls) {
			const { costUsd, unpriced } = contribution(call);
			const tokens = tokensOf(call);
			accumulate(sessionAcc, call);
			accumulate(totals, call);
			if (unpriced) unknownModels.add(call.model);
			const modelKey = `${call.provider}/${call.model}`;
			const modelRow = byModel.get(modelKey);
			if (modelRow === void 0) byModel.set(modelKey, {
				provider: call.provider,
				model: call.model,
				apiCalls: 1,
				inputTokens: tokens.inputTokens,
				outputTokens: tokens.outputTokens,
				cacheReadTokens: tokens.cacheReadTokens,
				cacheWriteTokens: tokens.cacheWriteTokens,
				totalTokens: tokens.totalTokens,
				costUsd,
				unpriced
			});
			else {
				modelRow.apiCalls += 1;
				modelRow.inputTokens += tokens.inputTokens;
				modelRow.outputTokens += tokens.outputTokens;
				modelRow.cacheReadTokens += tokens.cacheReadTokens;
				modelRow.cacheWriteTokens += tokens.cacheWriteTokens;
				modelRow.totalTokens += tokens.totalTokens;
				modelRow.costUsd += costUsd;
			}
			const bucket = hourBucketOf(formatter, call.time);
			const hourRow = byHour.get(bucket.key);
			if (hourRow === void 0) byHour.set(bucket.key, {
				hour: bucket.key,
				hourStart: bucket.start,
				apiCalls: 1,
				inputTokens: tokens.inputTokens,
				outputTokens: tokens.outputTokens,
				cacheReadTokens: tokens.cacheReadTokens,
				cacheWriteTokens: tokens.cacheWriteTokens,
				totalTokens: tokens.totalTokens,
				costUsd
			});
			else {
				hourRow.apiCalls += 1;
				hourRow.inputTokens += tokens.inputTokens;
				hourRow.outputTokens += tokens.outputTokens;
				hourRow.cacheReadTokens += tokens.cacheReadTokens;
				hourRow.cacheWriteTokens += tokens.cacheWriteTokens;
				hourRow.totalTokens += tokens.totalTokens;
				hourRow.costUsd += costUsd;
			}
		}
		totals.toolCalls += log.toolCalls;
		totals.turns += log.turns;
		if (range !== void 0 && sessionAcc.apiCalls === 0 && log.toolCalls === 0 && log.turns === 0) continue;
		totals.sessions += 1;
		bySession.set(log.meta.id, {
			sessionId: log.meta.id,
			createdAt: new Date(log.meta.createdAt).toISOString(),
			...log.meta.parentSession !== void 0 ? { parentSession: log.meta.parentSession } : {},
			apiCalls: sessionAcc.apiCalls,
			inputTokens: sessionAcc.inputTokens,
			outputTokens: sessionAcc.outputTokens,
			cacheReadTokens: sessionAcc.cacheReadTokens,
			cacheWriteTokens: sessionAcc.cacheWriteTokens,
			totalTokens: sessionAcc.totalTokens,
			costUsd: sessionAcc.costUsd,
			firstEventAt: log.firstEventAt,
			lastEventAt: log.lastEventAt
		});
	}
	return {
		workspaceId: request.workspaceId,
		path,
		title,
		generatedAt,
		timeZone: request.timeZone,
		...request.rangeStart !== void 0 ? { rangeStart: request.rangeStart } : {},
		...request.rangeEnd !== void 0 ? { rangeEnd: request.rangeEnd } : {},
		totals: { ...totals },
		byHour: [...byHour.values()].sort((a, b) => a.hourStart - b.hourStart).map((row) => ({ ...row })),
		byModel: [...byModel.values()].sort((a, b) => b.costUsd - a.costUsd || b.apiCalls - a.apiCalls).map((row) => ({ ...row })),
		bySession: [...bySession.values()].sort((a, b) => b.lastEventAt - a.lastEventAt),
		unknownModels: [...unknownModels].sort(),
		pricing: DEEPSEEK_PRICING
	};
}
/**
* Project one canonical event onto the raw row the session-log view renders.
* @param event - the stored event.
* @returns its identity, instant, type, and lossless payload.
*/
function logEventOf(event) {
	return {
		seq: event.seq,
		time: event.time,
		type: event.type,
		data: event.data
	};
}
/** Concurrent stored-log reads while folding a report; bounds memory while parallelizing I/O. */
const REPORT_READ_CONCURRENCY = 8;
/** Compute the usage report for one Workspace from its persisted session logs. */
var WorkspaceUsage = class {
	ctx;
	/** @param ctx - Host context carrying the Workspace registry and session persistence. */
	constructor(ctx) {
		this.ctx = ctx;
	}
	/**
	* Fold every accounted Session log of a Workspace into a usage report.
	* Stored reads run concurrently (bounded) so a large Workspace does not
	* serialize every log read.
	* @param request - target Workspace and caller-local time zone.
	* @param signal - cancellation for persistence reads.
	* @returns the computed report.
	* @throws RemoteError `usage/workspace-not-found` when the Workspace is unknown.
	*/
	async report(request, signal) {
		const workspace = this.ctx.workspaceRegistry.get(request.workspaceId);
		if (workspace === void 0) throw new RemoteError("usage/workspace-not-found", `cannot build a usage report: unknown workspace "${request.workspaceId}"`, { workspaceId: request.workspaceId });
		const range = rangeOf(request);
		const logs = [];
		const ids = workspace.sessionIds;
		const pending = ids[Symbol.iterator]();
		const worker = async () => {
			for (;;) {
				signal.throwIfAborted();
				const next = pending.next();
				if (next.done === true) return;
				const sessionId = next.value;
				const live = this.ctx.sessions.get(sessionId);
				if (live !== void 0) {
					logs.push(foldSessionLog(live.header, live.snapshotEvents(), range));
					continue;
				}
				const cold = await this.readStoredLog(sessionId, signal);
				if (cold === void 0) continue;
				logs.push(foldSessionLog(cold.header, cold.events, range));
			}
		};
		await Promise.all(Array.from({ length: Math.min(REPORT_READ_CONCURRENCY, ids.length) }, worker));
		return buildUsageReport(request, workspace.path, workspace.title, Date.now(), logs);
	}
	/**
	* Read the raw event log of one Session accounted to a Workspace.
	* @param request - Workspace and Session identities.
	* @param signal - cancellation for persistence reads.
	* @returns the Session's creation instant and its newest event rows.
	* @throws RemoteError `usage/workspace-not-found` for an unknown Workspace,
	*   `usage/session-not-in-workspace` for a Session the Workspace does not
	*   account, and `usage/session-log-unavailable` when no stored log exists
	*   for the Session.
	*/
	async sessionLog(request, signal) {
		const workspace = this.ctx.workspaceRegistry.get(request.workspaceId);
		if (workspace === void 0) throw new RemoteError("usage/workspace-not-found", `cannot read a session log: unknown workspace "${request.workspaceId}"`, { workspaceId: request.workspaceId });
		if (!workspace.sessionIds.includes(request.sessionId)) throw new RemoteError("usage/session-not-in-workspace", `session "${request.sessionId}" is not accounted to workspace "${request.workspaceId}"`, {
			workspaceId: request.workspaceId,
			sessionId: request.sessionId
		});
		const cold = await this.readStoredLog(request.sessionId, signal);
		if (cold === void 0) throw new RemoteError("usage/session-log-unavailable", `no persisted log exists for session "${request.sessionId}"`, { sessionId: request.sessionId });
		const truncated = cold.events.length > 500;
		const kept = truncated ? cold.events.slice(-500) : cold.events;
		return {
			sessionId: request.sessionId,
			createdAt: new Date(cold.header.createdAt).toISOString(),
			truncated,
			events: kept.map(logEventOf)
		};
	}
	/**
	* Read one stored session log through a read handle, which never takes
	* ownership and so works while the session's writer holds it. Absence is a
	* value, not a failure: a Workspace keeps accounting a Session whose log has
	* been deleted, and both callers treat that as no data. The stored events
	* are returned as recorded — an interrupted tail is not repaired, because
	* neither an accounting fold nor a raw log view may show a response that was
	* never recorded.
	* @param sessionId - the stored Session to read.
	* @param signal - cancellation for the open and read.
	* @returns the stored header and events, or undefined when no log exists.
	*/
	async readStoredLog(sessionId, signal) {
		const handle = await this.ctx.sessionPersistence.open(sessionId, "read", { signal }).catch((error) => {
			if (error instanceof SessionPersistenceNotFoundError) return void 0;
			throw error;
		});
		if (handle === void 0) return void 0;
		try {
			return {
				header: handle.header,
				events: await handle.read(void 0, void 0, { signal })
			};
		} finally {
			await handle.close();
		}
	}
};
//#endregion
//#region lib/types/index.js
/**
* Usage-report Remote owner: the per-workspace usage report and raw
* session-log read, computed from persisted session logs. A read-only,
* optional capability — composed only when the usage-dashboard bundle is
* installed, so the base workspace controller stays unmodified.
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Host service backing the generated `ctx.remote.usage` namespace. */
let UsageController = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _report_decorators;
	let _sessionLog_decorators;
	return class UsageController extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_report_decorators = [Remote("report")];
			_sessionLog_decorators = [Remote("sessionLog")];
			__esDecorate(this, null, _report_decorators, {
				kind: "method",
				name: "report",
				static: false,
				private: false,
				access: {
					has: (obj) => "report" in obj,
					get: (obj) => obj.report
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _sessionLog_decorators, {
				kind: "method",
				name: "sessionLog",
				static: false,
				private: false,
				access: {
					has: (obj) => "sessionLog" in obj,
					get: (obj) => obj.sessionLog
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = [
			"typert",
			"workspaceRegistry",
			"sessionPersistence",
			"sessions"
		];
		usage = __runInitializers(this, _instanceExtraInitializers);
		/** @param ctx - Host context containing the Workspace registry and session persistence. */
		constructor(ctx) {
			super(ctx, "usageController", { namespace: "usage" });
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
			} catch {
				return Promise.reject(new RemoteError("gateway/bad-request", `usage report: unknown time zone "${request.timeZone}"`, {}));
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
//#endregion
export { DEEPSEEK_PRICING, UsageController, UsageController as default, WorkspaceUsage, rangeOf };
