/* 集群间通讯,多主多从协同 
从将统计数据发给所有主,主1统一通知所有,主1->主2->...主n保持ping,顺位顶替
每个master也是worker,多份管理职责的worker
1.在当前节点端口+10000创建h2状态服务器,状态变化时由主0告知当前服务器和所有其它cluster
2.master之间顺位ping和替补
*/



