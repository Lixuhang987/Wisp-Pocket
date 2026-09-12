import Foundation

enum DynamicToolSchema {
    static func object(_ properties: [String: Any] = [:], required: [String] = []) -> [String: Any] {
        ["type": "object", "properties": properties, "required": required, "additionalProperties": false]
    }

    static func array(_ items: [String: Any], max: Int? = nil) -> [String: Any] {
        var schema: [String: Any] = ["type": "array", "items": items]
        if let max { schema["maxItems"] = max }
        return schema
    }

    static func spec(_ namespace: String, _ name: String, _ description: String, _ schema: [String: Any]) -> [String: Any] {
        ["clientId": "swift-host", "namespace": namespace, "name": name, "description": description, "inputSchema": schema]
    }

    static var string: [String: Any] { ["type": "string"] }
    static var identifier: [String: Any] {
        ["type": "string", "minLength": 1, "maxLength": 200, "pattern": "^[A-Za-z0-9._:-]+$"]
    }
    static var selector: [String: Any] { object(["role": string, "title": string]) }
}

enum BuiltinFeatureToolSpecs {
    private typealias S = DynamicToolSchema
    static var contextHistory: [[String: Any]] {
        let limit: [String: Any] = ["type": "integer", "minimum": 1, "maximum": 200, "default": 20]
        let date: [String: Any] = ["oneOf": [["type": "string", "format": "date-time"], ["type": "number"]]]
        return [
            S.spec("context_history", "activity_index",
                   "Read a lightweight activity index and collection status. Returns ids, timestamps, app/window and thumbnailId without AX trees or images. Collection errors are reported in collection.lastErrorMessage.",
                   S.object(["limit": limit])),
            S.spec("context_history", "sample_details",
                   "Read AX and activity details for 1...200 sample ids. Missing ids or missing/corrupt evidence fail with an explicit error.",
                   S.object(["ids": ["type": "array", "items": ["type": "string", "minLength": 1], "minItems": 1, "maxItems": 200]], required: ["ids"])),
            S.spec("context_history", "thumbnails",
                   "Read stored thumbnails, newest first, optionally within inclusive start/end (ISO8601 or epoch seconds). Returns JSON metadata with sampleId, dimensions and imageContentIndex followed by inputImage items. Missing/corrupt files fail.",
                   S.object(["limit": limit, "start": date, "end": date])),
            S.spec("context_history", "screenshot_original",
                   "Read one stored original PNG by screenshot id. Returns screenshot metadata and an inputImage item. Unknown ids or missing/corrupt files fail.",
                   S.object(["id": ["type": "string", "minLength": 1]], required: ["id"])),
        ]
    }

    private static var step: [String: Any] {
        S.object([
            "kind": ["type": "string", "enum": ["activateApp", "click", "setValue", "typeText", "hotkey", "waitFor"]],
            "selector": S.selector, "value": S.string, "bundleId": S.string,
            "condition": S.object(["selector": S.selector], required: ["selector"]),
            "timeoutMs": ["type": "integer", "minimum": 0, "maximum": 300000],
            "position": S.object(["x": ["type": "number"], "y": ["type": "number"]], required: ["x", "y"]),
            "button": ["type": "string", "enum": ["left", "right", "other"]],
        ], required: ["kind"])
    }

    private static var branch: [String: Any] {
        S.object([
            "id": S.identifier,
            "conditions": S.array(S.object(["selector": S.selector], required: ["selector"])),
            "steps": S.array(step),
            "assertions": S.array(S.object(["selector": S.selector], required: ["selector"])),
        ], required: ["id", "steps", "assertions"])
    }

    private static var policy: [String: Any] {
        S.object([
            "id": S.identifier, "version": ["type": "integer", "minimum": 1],
            "title": S.string, "targetBundleId": S.string, "branches": S.array(branch),
        ], required: ["id", "version", "title", "branches"])
    }

    private static var event: [String: Any] {
        S.object([
            "kind": ["type": "string", "enum": ["activateApp", "click", "press", "setValue", "typeText", "hotkey", "waitFor", "assertion"]],
            "selector": S.selector, "value": S.string, "text": S.string, "bundleId": S.string,
            "keys": ["oneOf": [S.string, S.array(S.string)]],
            "timeoutMs": ["type": "integer", "minimum": 0, "maximum": 300000],
            "position": S.object(["x": ["type": "number"], "y": ["type": "number"]], required: ["x", "y"]),
            "button": ["type": "string", "enum": ["left", "right", "other"]],
        ], required: ["kind"])
    }

    static var automation: [[String: Any]] {
        [
            S.spec("automation", "record_start",
                   "Start an in-memory recording session retained across tool calls. Returns recordingId and initial app/AX/PNG evidence (individual capture errors are explicit). Evidence images are inputImage items referenced by imageContentIndex in the JSON. captureUserEvents opts into macOS event recording and fails if permission is unavailable.",
                   S.object(["recordingId": S.identifier, "targetBundleId": S.string, "captureUserEvents": ["type": "boolean", "default": false]])),
            S.spec("automation", "record_event",
                   "Append an already performed action or assertion to an active recording; this tool records evidence and does not execute the action. Returns eventIndex and evidence. Unknown recordingId fails.",
                   S.object(["recordingId": S.identifier, "event": event], required: ["recordingId", "event"])),
            S.spec("automation", "record_stop",
                   "Stop and persist an active recording as a Trace. Without recordingId, import a nonempty events trace. Returns traceId, eventCount and (for active recordings) finalEvidence with inputImage. Live events retain timestamps and reference shared Trace.finalEvidence via evidenceRef, labelled recording_stop.",
                   S.object(["recordingId": S.identifier, "traceId": S.identifier, "events": S.array(event), "targetBundleId": S.string])),
            S.spec("automation", "policy_create",
                   "Save an explicit policy, or create a policy from branch or saved traceId. Returns the saved policy. Trace conversion supports the declared steps and assertions; missing traces, empty branches and unsupported events fail.",
                   S.object(["policy": policy, "branch": branch, "traceId": S.identifier, "policyId": S.identifier, "title": S.string, "targetBundleId": S.string])),
            S.spec("automation", "run",
                   "Load and run a saved policy through real host actions, conditions and assertions. Returns run with step progress and evidence; imageContentIndex references inputImage items. Waits for the actual result. Only completed execution succeeds; failed/cancelled runs return success=false and are persisted. Failures create pending repair data, never automatic successful repairs.",
                   S.object(["policyId": S.identifier], required: ["policyId"])),
            S.spec("automation", "history",
                   "Read persisted runs, patches and repairRequests, including failure reasons, step progress and app/AX/PNG evidence. Evidence imageContentIndex references inputImage items; repeated images share an index. Data corruption or read errors fail explicitly.",
                   S.object()),
            S.spec("automation", "apply_patch",
                   "Apply a saved patch to its source policy version. Returns updated policy and patch; stale versions fail. Applying a patch does not execute the policy or change any failed run to success.",
                   S.object(["patchId": S.identifier], required: ["patchId"])),
            S.spec("automation", "repair_apply",
                   "Apply an explicitly supplied branch to a pending repair request at its original policy version. Returns policy, patch and applied repairRequest. Requires a new run to verify success; no model is invoked.",
                   S.object([
                    "repairRequestId": S.identifier, "patchId": S.identifier, "branch": branch,
                    "evidence": ["type": "object", "additionalProperties": S.string],
                   ], required: ["repairRequestId", "branch"])),
        ]
    }
}
