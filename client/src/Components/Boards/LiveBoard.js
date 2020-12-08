import React, { useEffect, useRef, useState } from 'react'
import { useHistory, useLocation, useParams } from 'react-router-dom'
import { Container, Draggable } from 'react-smooth-dnd'
import { initDnDState, colDragStyle, getBg } from '../utils/general'
import { addNewTask, delExistTask, newStatusBuilder, reGroupListHelp, reOrderListHelp, reOrderStatusHelp } from '../utils/dataManager'
import decideUpdate from '../utils/decideUpdate'
import io from 'socket.io-client'
import LiveLists from './LiveLists'
import axios from 'axios'

let socket;

function LiveBoard({ headers }) {
    const history = useHistory()
    const { room } = useParams()
    const { state } = useLocation()
    const createStatusRef = useRef(null)
    const [detailed, setDetailed] = useState(state.board)
    const [create, setCreate] = useState(false)
    const [newStatus, setStatus] = useState("")
    const [listDnD, setlistDnD] = useState(initDnDState)

    useEffect(() => {
        socket = io("/")
        socket.emit("enter-room", { room: detailed.room })

        socket.on("update-board", (data) => {
            setDetailed(prev => decideUpdate(prev, data))
        })

        return () => leave()
    }, [])

    const leave = () => {
        socket.on('disconnect')
        socket.off()
        history.push('/')
    }

    const createNewStatus = (status) => {
        let payload = {
            boardId: detailed._id,
            status
        }

        axios.put("/board/add-status", { ...payload }, { headers })
            .then(() => {
                setDetailed(prev => newStatusBuilder(prev, payload))
                socket.emit("update-board", {
                    room,
                    payload: {
                        status,
                        action: "new-status"
                    }
                })
            })
            .catch((err) => {
                console.log(err)
            })
    }

    const addTitle = (payload) => {
        setDetailed(prev => {
            return {
                ...prev,
                tasks: addNewTask(prev.tasks, payload)
            }
        })
        payload.action = "new-title"
        socket.emit("update-board", {
            room,
            payload
        })
    }

    const delTitle = (payload) => {
        setDetailed(prev => {
            return {
                ...prev,
                tasks: delExistTask(prev.tasks, payload)
            }
        })
        payload.action = "del-title"
        socket.emit("update-board", {
            room,
            payload
        })
    }

    const reOrderStatus = (payload) => {
        setDetailed(prev => reOrderStatusHelp(prev, payload))
        axios.put("/board/reorder-status", { boardId: detailed._id, from: payload.dragFrom, to: payload.dragTo }, { headers })
            .then((res) => {
                console.log(res)
            })
            .catch((err) => {
                console.log(err)
            })
    }

    const reOrder = () => {
        let payload = {
            boardId: detailed._id,
            from: listDnD.dragFrom,
            to: listDnD.dragTo
        }
        if (payload.from && payload.to) {
            let from = `${payload.from.status} ${payload.from.pos}`
            let to = `${payload.to.status} ${payload.to.pos}`
            let sameCheck = from === to

            if (!sameCheck) {
                if (payload.from.status === payload.to.status) {
                    axios.put("/board/reorder-task", {
                        boardId: detailed._id,
                        taskId: payload.from.id,
                        status: payload.from.status,
                        to: payload.to.pos
                    }, { headers })
                        .then(() => {
                            setDetailed(prev => {
                                return {
                                    ...prev,
                                    tasks: reOrderListHelp(prev.tasks, payload)
                                }
                            })
                            payload.action = "reorder-list"
                            socket.emit("update-board", {
                                room,
                                payload
                            })
                        })
                        .catch((err) => {
                            console.log(err)
                        })
                } else {
                    axios.put("/board/restatus-task", {
                        boardId: detailed._id,
                        taskId: payload.from.id,
                        fromStatus: payload.from.status,
                        toStatus: payload.to.status,
                        to: payload.to.pos
                    }, { headers })
                        .then(() => {
                            setDetailed(prev => {
                                return {
                                    ...prev,
                                    tasks: reGroupListHelp(prev.tasks, payload)
                                }
                            })
                            payload.action = "restatus-list"
                            socket.emit("update-board", {
                                room,
                                payload
                            })
                        })
                        .catch((err) => {
                            console.log(err)
                        })
                }
            }
        }
        setlistDnD({ ...initDnDState })
    }

    const onColumnDrop = (e) => {
        const { removedIndex, addedIndex } = e
        if (removedIndex !== null && addedIndex !== null && removedIndex !== addedIndex) {
            let payload = {
                boardId: detailed._id,
                dragFrom: removedIndex,
                dragTo: addedIndex
            }
            reOrderStatus(payload)
            payload.action = "reorder-status"
            socket.emit("update-board", {
                room,
                payload
            })
        }
        setlistDnD({ ...initDnDState })
    }

    const doNothing = e => { return }

    const addStatus = () => {
        createNewStatus(newStatus)
        setStatus("")
        createStatusRef.current.focus()
    }

    return (
        <div className="board" style={getBg(detailed.bg)}>
            <div className="board-head">
                <div className="bh-top"> {detailed.boardName} </div>
                <div className="bh-top"> {detailed.catagery} </div>
                <div className="bh-top" onClick={leave}>Leave room</div>
            </div>

            <Container
                groupName="status"
                style={colDragStyle}
                orientation="horizontal"
                getChildPayload={i => i}
                dragHandleSelector=".column-drag-handle"
                nonDragAreaSelector=".nondrag"
                onDragStart={e => doNothing(e)}
                onDragEnd={e => doNothing(e)}
                onDrop={e => onColumnDrop(e)}
                onDragEnter={() => doNothing()}
                onDragLeave={() => doNothing()}
                onDropReady={e => doNothing(e)}
                dropPlaceholder={{
                    animationDuration: 150,
                    showOnTop: true,
                    className: 'staus-drop-preview'
                }}
            >
                {
                    detailed.taskStatus?.map(status => {
                        return (
                            <Draggable key={status} className="status-holder">
                                <p className="status-title"><strong className="column-drag-handle">{status}</strong></p>
                                <LiveLists
                                    status={status}
                                    headers={headers}
                                    boardId={detailed._id}
                                    list={detailed.tasks.filter(t => t.status === status)[0].tasks}
                                    taskStatus={detailed.taskStatus}
                                    setlistDnD={setlistDnD}
                                    reOrder={reOrder}
                                    addTitle={addTitle}
                                    delTitle={delTitle}
                                />
                            </Draggable>
                        )
                    })
                }

                <div className="nondrag">
                    {
                        !create
                            ?
                            <p
                                className="new-status"
                                onClick={() => {
                                    setCreate(prev => !prev)
                                    setTimeout(() => {
                                        createStatusRef.current.focus()
                                    }, 0)
                                }}>
                                Create new status
                            </p>
                            :
                            <div className="list-lasts">
                                <input
                                    className="input-box"
                                    type="text"
                                    placeholder="add new title..."
                                    value={newStatus}
                                    ref={createStatusRef}
                                    onKeyDown={e => e.key === "Enter" ? addStatus() : null}
                                    onChange={e => setStatus(e.target.value)}
                                />
                                <button onClick={addStatus}>
                                    Create
                                </button>
                                <button onClick={() => setCreate(prev => !prev)}>Cancel</button>
                            </div>
                    }
                </div>
            </Container>
        </div>
    )
}

export default LiveBoard