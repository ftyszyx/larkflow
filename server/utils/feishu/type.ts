export type FeishuResp<T = unknown> = {
    code: number;
    msg: string;
    data?: T;
}

export type FieshuTenantTokenResponse = FeishuResp<undefined> & {
    tenant_access_token: string;
    expire: number;
}


export type FeishuDocInfo = {
    document: {
        cover: {
            token: string;
        };
        document_id?: string;
        title?: string;
        revision_id?: number;
    }
}

// export type FeishuDocxBlocksResponse = FeishuResp<{ items: unknown[]; has_more: boolean; page_token: string; }>

export type FeishuBlockInfo = {
    items: unknown[];
    has_more: boolean;
    page_token: string;
}



export type FeishuWikiNodeInfo = {
    node: {
        creator: string;
        has_child: boolean;
        node_create_time: number;
        node_creator: string;
        node_token: string;//节点的 token
        node_type: string;//节点的类型
        obj_create_time: number;//节点的实际云文档的创建时间
        obj_edit_time: number;//节点的实际云文档的编辑时间
        obj_token: string;//节点的实际云文档的 token
        obj_type: string;//节点的实际云文档的类型
        space_id: string;
        title: string;
        owner: string;
    }
}